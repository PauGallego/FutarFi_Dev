// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {MarketToken} from "./MarketToken.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";


interface IMarket {
    function initialize(
        IERC20 _collateralToken,
        uint256 _maxSupply,
        address _pythAddress,
        bytes32 _collateralPriceId,
        address _marketTokenImpl
    ) external;

    function openMarket() external;
    function closeMarket() external;

    function buy(bool optionIndex, uint256 amount) external;
    function sell(bool optionIndex, uint256 tokenAmount) external;

    function getMarketTypePrice(uint8 idx) external view returns (uint256);
    function totalSupply() external view returns (uint256 tot0, uint256 tot1);
    function maxSupply() external view returns (uint256);
    function isOpen() external view returns (bool);
    function userCollateral(address user, uint8 optionIndex) external view returns (uint256);
}

contract Market is Ownable, IMarket {
    error E_AlreadyInitialized();
    error E_ZeroAddress();
    error E_MarketClosed();
    error E_MarketOpen();
    error E_InvalidOption();
    error E_InsufficientSupply();
    error E_InsufficientBalance();
    error E_TransferFailed();

    struct MarketType {
        uint256 asset_price;     
        uint256 totalCollateral; 
        uint256 totalSupply;     
    }

    bool private _initialized;

    IERC20          public collateralToken;
    MarketToken     public approveToken; 
    MarketToken     public rejectToken;  
    uint256         public override maxSupply;
    bytes32 public collateralPriceId;


    // 0 = approve side, 1 = reject side
    MarketType[2]       public marketType;
    IPyth           public pyth;
    bool            public override isOpen;

    uint256 public impactFactor; 

    // track per-user deposited collateralToken by MarketType (for settle/refund)
    mapping(address => mapping(uint8 => uint256)) public override userCollateral;

    // Participants tracking for automatic settlement
    address[] private participants0; 
    address[] private participants1; 
    mapping(address => bool[2]) private addedParticipant; 

    event MarketInitialized(address collateralToken, address approveToken, address rejectToken, uint256 maxSupply);
    event MarketOpened();
    event MarketClosed();
    event Bought(address indexed user, uint8 indexed optionIndex, uint256 collateralIn, uint256 newPrice);
    event Sold(address indexed user, uint8 indexed optionIndex, uint256 tokenAmount, uint256 collateralOut, uint256 newPrice);
    event PythSet(address indexed pyth);
    event CollateralPriceIdSet(bytes32 indexed pid);
    event PriceRefreshed(uint8 indexed optionIndex, uint256 price18, uint publishTime);
    event MarketSettled(uint8 winnerIndex, uint8 loserIndex);

   // ------------------- Modifiers -------------------
    modifier isPyth() {
        require(msg.sender == address(pyth), "only pyth");
        _;
    }

    modifier isMarketOpen() {
        require(isOpen, "market closed");
        _;
    }

    modifier isPythDefined() {
        require(address(pyth) != address(0), "pyth not set");
        _;
    }

    constructor() Ownable(msg.sender) {}

    function initialize(
        IERC20 _collateralToken,
        uint256 _maxSupply,
        address _pythAddress,
        bytes32 _collateralPriceId,
        address _marketTokenImpl
    ) external {

        collateralToken = _collateralToken;

        // 0.05 in 1e18 = 5% max sensitivity per 1.0 ratio
        impactFactor = 5e16; 


        // Clone approve token
        address t0 = Clones.clone(_marketTokenImpl);
        MarketToken(t0).initialize("Approve Token", "APT");
        approveToken = MarketToken(t0);

        // Clone reject token
        address t1 = Clones.clone(_marketTokenImpl);
        MarketToken(t1).initialize("Reject Token", "RJT");
        rejectToken = MarketToken(t1);
        
        maxSupply = _maxSupply;

        // initial mint to the contract to act as sellable supply
        approveToken.mint(address(this), _maxSupply);
        rejectToken.mint(address(this), _maxSupply);

        // Initialize marketType with Pyth price if available
        uint256 basePrice = 1e18;
        if (_pythAddress != address(0) && _collateralPriceId != bytes32(0)) {
            pyth = IPyth(_pythAddress);
            (uint256 pcol, ) = getPythPrice(_collateralPriceId);
            basePrice = pcol;
            emit PythSet(_pythAddress);
            emit CollateralPriceIdSet(_collateralPriceId);
        }
        marketType[0] = MarketType({asset_price: basePrice, totalCollateral: 0 , totalSupply: _maxSupply});
        marketType[1] = MarketType({asset_price: basePrice, totalCollateral: 0 , totalSupply: _maxSupply});

        collateralPriceId = _collateralPriceId;
        isOpen = true;
        
        _transferOwnership(msg.sender); // set the proxy owner to caller of initialize()
        emit MarketInitialized(address(_collateralToken), address(approveToken), address(rejectToken), _maxSupply);
    }

     // ------------------- Owner / Pyth Setup -------------------
    function setPyth(address _pyth) external onlyOwner  {
        require(_pyth != address(0), "zero address");
        pyth = IPyth(_pyth);
        emit PythSet(_pyth);
    }

    function setCollateralPriceId(bytes32 _pid) external onlyOwner {
        collateralPriceId = _pid;
        emit CollateralPriceIdSet(_pid);
    }

    function setImpactFactor(uint256 newFactor18) external onlyOwner {
        impactFactor = newFactor18;
    }

    function openMarket() external onlyOwner { isOpen = true; }
    function closeMarket() external onlyOwner { isOpen = false; }

    // ------------------- Pyth Helpers -------------------
    function getPythPrice(bytes32 priceId) public view isPythDefined returns (uint256 price18, uint publishTime)  {
        PythStructs.Price memory p = pyth.getPriceUnsafe(priceId);
        int64 price = p.price;
        int32 expo = p.expo;
        publishTime = p.publishTime;
        require(price > 0, "invalid price");

        uint256 absPrice = uint256(int256(price));
        int256 combined = int256(expo) + 18;

        if (combined >= 0) {
            price18 = absPrice * (10 ** uint256(combined));
        } else {
            price18 = absPrice / (10 ** uint256(-combined));
        }
    }


    // ------------------- Market Logic -------------------
    /**
     * @notice The core market logic was initially designed with the help of AI to ensure basic functionality.
     *         However, active corrections, optimizations, and ongoing maintenance are being performed by
     *         the development team. It is essential that developers continue to review, audit, and adjust
     *         these mechanisms over time to ensure reliability, security, and proper market behavior.
     *
    */

    function _ln(uint256 x) internal pure returns (uint256) {
        if (x <= 1e18) return 0;
        uint256 log2x = 0;
        uint256 temp = x;
        while (temp > 2e18) {
            temp = temp / 2;
            log2x += 1e18;
        }
        uint256 frac = ((temp - 1e18) * 1e18) / 1e18;
        log2x += (frac / 2);
        return (log2x * 693147000000000000) / 1e18;
    }

    function _applyTradeImpact(
        uint256 currentPrice,
        uint256 tradeSize,
        uint256 totalCollateral
    ) internal view returns (uint256 priceUp, uint256 priceDown) {
        // Prevent division by zero
        uint256 adjustedCollateral = totalCollateral + 1e18;

        // Trade ratio relative to pool
        uint256 ratio = (tradeSize * 1e18) / adjustedCollateral;

        // Logarithmic impact: ln(1 + ratio)
        uint256 logFactor = _ln(1e18 + ratio);

        // Scale by impact factor
        uint256 impact = (impactFactor * logFactor) / 1e18;

        // Symmetric effect
        priceUp = (currentPrice * (1e18 + impact)) / 1e18;
        priceDown = (currentPrice * 1e18) / (1e18 + impact);
    }

    function buy(bool optionIndex, uint256 amount) external isMarketOpen {
        require(amount > 0, "zero amount");

        require(collateralToken.transferFrom(msg.sender, address(this), amount), "transfer failed");
        uint8 option = optionIndex ? 0 : 1;

        uint256 currentPrice = marketType[option].asset_price;

        (uint256 effectivePrice, ) = _applyTradeImpact(currentPrice, amount, marketType[option].totalCollateral);

        uint256 tokensToMint = (amount * 1e18) / effectivePrice;

        if (optionIndex) {
            require(approveToken.balanceOf(address(this)) >= tokensToMint, "insufficient approveToken supply");
            approveToken.transfer(msg.sender, tokensToMint);
            if (!addedParticipant[msg.sender][option]) {
                participants0.push(msg.sender);
                addedParticipant[msg.sender][option] = true;
            }
        } else {
            require(rejectToken.balanceOf(address(this)) >= tokensToMint, "insufficient rejectToken supply");
            rejectToken.transfer(msg.sender, tokensToMint);
            if (!addedParticipant[msg.sender][option]) {
                participants1.push(msg.sender);
                addedParticipant[msg.sender][option] = true;
            }
        }

        marketType[option].totalSupply -= tokensToMint;
        marketType[option].totalCollateral += amount;
        userCollateral[msg.sender][option] += amount;

        // Update option price after trade
        (marketType[option].asset_price, ) = _applyTradeImpact(
            marketType[option].asset_price,
            amount,
            marketType[option].totalCollateral
        );

        emit Bought(msg.sender, option, amount, marketType[option].asset_price);
    }

    function sell(bool optionIndex, uint256 tokenAmount) external isMarketOpen {
        require(tokenAmount > 0, "zero amount");
        uint8 option = optionIndex ? 0 : 1;

        if (optionIndex) {
            require(approveToken.balanceOf(msg.sender) >= tokenAmount, "insufficient approveToken balance");
        } else {
            require(rejectToken.balanceOf(msg.sender) >= tokenAmount, "insufficient rejectToken balance");
        }

        uint256 currentPrice = marketType[option].asset_price;
        uint256 tradeCollateral = (tokenAmount * currentPrice) / 1e18;

        (, uint256 effectiveSellPrice) = _applyTradeImpact(currentPrice, tradeCollateral, marketType[option].totalCollateral);

        uint256 collateralOut = (tokenAmount * effectiveSellPrice) / 1e18;
        require(collateralToken.balanceOf(address(this)) >= collateralOut, "insufficient collateralToken in contract");

        if (optionIndex) {
            approveToken.transferFrom(msg.sender, address(this), tokenAmount);
        } else {
            rejectToken.transferFrom(msg.sender, address(this), tokenAmount);
        }

        marketType[option].totalSupply += tokenAmount;
        marketType[option].totalCollateral -= collateralOut;
        userCollateral[msg.sender][option] -= collateralOut;

        require(collateralToken.transfer(msg.sender, collateralOut), "payout failed");

        // Update option price after trade
        (, marketType[option].asset_price) = _applyTradeImpact(
            marketType[option].asset_price,
            collateralOut,
            marketType[option].totalCollateral
        );

        emit Sold(msg.sender, option, tokenAmount, collateralOut, marketType[option].asset_price);
    }


    // ------------------- Automatic Settlement -------------------
    function settleMarket(bool isApproveWinner) external onlyOwner isMarketOpen {
        isOpen = false;
        uint8 winnerIndex = isApproveWinner ? 0 : 1;
        uint8 loserIndex = isApproveWinner ? 1 : 0;

        address[] storage winners = winnerIndex == 0 ? participants0 : participants1;
        address[] storage losers = loserIndex == 0 ? participants0 : participants1;

        // Pay winners using current option_price and burn their tokens
        for (uint i = 0; i < winners.length; i++) {
            address user = winners[i];
            uint256 tokenBalance = winnerIndex == 0 ? approveToken.balanceOf(user) : rejectToken.balanceOf(user);
            if (tokenBalance > 0) {
                uint256 payout = (tokenBalance * marketType[winnerIndex].asset_price) / 1e18;
                
                // Burn tokens directly from user (Market contract is owner of tokens)
                if (winnerIndex == 0) {
                    approveToken.burn(user, tokenBalance);
                } else {
                    rejectToken.burn(user, tokenBalance);
                }
                
                require(collateralToken.transfer(user, payout), "payout failed");
                userCollateral[user][winnerIndex] = 0;
            }
        }

        // Return all collateral to losers and burn their tokens
        for (uint i = 0; i < losers.length; i++) {
            address user = losers[i];
            uint256 tokenBalance = loserIndex == 0 ? approveToken.balanceOf(user) : rejectToken.balanceOf(user);
            
            // Burn loser tokens directly
            if (tokenBalance > 0) {
                if (loserIndex == 0) {
                    approveToken.burn(user, tokenBalance);
                } else {
                    rejectToken.burn(user, tokenBalance);
                }
            }

            // Return original collateral to losers
            uint256 collat = userCollateral[user][loserIndex];
            if (collat > 0) {
                require(collateralToken.transfer(user, collat), "return collateral failed");
                userCollateral[user][loserIndex] = 0;
            }
        }

        emit MarketSettled(winnerIndex, loserIndex);
    }

    // ------------------- Market Revert (Equal Prices) -------------------
    function revertMarket() external onlyOwner isMarketOpen {
        isOpen = false;

        // Return all collateral to all participants on both sides
        // No winners/losers, everyone gets their original investment back

        // Handle approve side participants
        for (uint i = 0; i < participants0.length; i++) {
            address user = participants0[i];
            uint256 tokenBalance = approveToken.balanceOf(user);
            
            // Burn their tokens
            if (tokenBalance > 0) {
                approveToken.burn(user, tokenBalance);
            }

            // Return original collateral
            uint256 collat = userCollateral[user][0];
            if (collat > 0) {
                require(collateralToken.transfer(user, collat), "revert collateral failed");
                userCollateral[user][0] = 0;
            }
        }

        // Handle reject side participants
        for (uint i = 0; i < participants1.length; i++) {
            address user = participants1[i];
            uint256 tokenBalance = rejectToken.balanceOf(user);
            
            // Burn their tokens
            if (tokenBalance > 0) {
                rejectToken.burn(user, tokenBalance);
            }

            // Return original collateral
            uint256 collat = userCollateral[user][1];
            if (collat > 0) {
                require(collateralToken.transfer(user, collat), "revert collateral failed");
                userCollateral[user][1] = 0;
            }
        }

        emit MarketSettled(255, 255); // Special event values indicating full revert
    }

    // ------------------- Views -------------------
    function getMarketTypePrice(uint8 idx) external view returns (uint256) {
        require(idx < 2, "invalid index");
        return marketType[idx].asset_price;
    }

    function totalCollateralSupply() external view returns (uint256 tot0, uint256 tot1) {
        tot0 = marketType[0].totalCollateral;
        tot1 = marketType[1].totalCollateral;       
    }

    function totalSupply() external view returns (uint256 tot0, uint256 tot1) {
        tot0 = marketType[0].totalSupply;
        tot1 = marketType[1].totalSupply;       
    }
}
