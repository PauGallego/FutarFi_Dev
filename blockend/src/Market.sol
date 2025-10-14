// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {MarketToken} from "./MarketToken.sol";
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

interface IMarket {
    function openMarket() external;
    function closeMarket() external;

    function buy(uint8 optionIndex, uint256 amount) external;
    function sell(uint8 optionIndex, uint256 tokenAmount) external;

    function getOptionPrice(uint8 idx) external view returns (uint256);
    function getTotals() external view returns (uint256 tot0, uint256 tot1);

    function setPyth(address _pyth) external;
    function setPriceId(uint8 idx, bytes32 pid) external;
    function setImpactFactor(uint256 newFactor18) external;

    function collateral() external view returns (address);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function maxSupply() external view returns (uint256);
    function isOpen() external view returns (bool);

    function userCollateral(address user, uint8 optionIndex) external view returns (uint256);
}

contract Market is Ownable {

    // ------------------- Structs -------------------
    struct Option {
        bytes32 priceId;         // Pyth feed ID
        uint256 asset_price;     // Price in 1e18
        uint256 totalCollateral; // Total collateral staked in this option
    }

    // ------------------- State Variables -------------------
    IERC20 public collateral;
    MarketToken public token0;
    MarketToken public token1;
    uint256 public maxSupply;

    Option[2] public options;
    IPyth public pyth;

    bool public isOpen;
    uint256 public impactFactor = 5 * 10**16; // 0.05 in 1e18

    mapping(address => uint256[2]) public userCollateral; // userCollateral[user][optionIndex]

    // Participants tracking for automatic settlement
    address[] private participants0; // participants for option 0
    address[] private participants1; // participants for option 1
    mapping(address => bool) private addedParticipant; // avoid duplicates

    // ------------------- Events -------------------
    event Bought(address indexed user, uint8 indexed optionIndex, uint256 collateralIn, uint256 newPrice);
    event Sold(address indexed user, uint8 indexed optionIndex, uint256 tokenAmount, uint256 collateralOut, uint256 newPrice);
    event PythSet(address indexed pyth);
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

    // ------------------- Constructor -------------------
    constructor(
        IERC20 _collateral,
        string memory _t0name, string memory _t0sym,
        string memory _t1name, string memory _t1sym,
        uint256 _maxSupply,
        address _pythAddress,
        bytes32 _priceId0,
        bytes32 _priceId1
    ) Ownable(msg.sender) {
        collateral = _collateral;
        token0 = new MarketToken(_t0name, _t0sym);
        token1 = new MarketToken(_t1name, _t1sym);
        maxSupply = _maxSupply;

        token0.mint(address(this), _maxSupply);
        token1.mint(address(this), _maxSupply);

        options[0] = Option({ priceId: _priceId0, asset_price: 1e18, totalCollateral: 0 });
        options[1] = Option({ priceId: _priceId1, asset_price: 1e18, totalCollateral: 0 });

        if (_pythAddress != address(0)) {
            pyth = IPyth(_pythAddress);
            emit PythSet(_pythAddress);
        }

        isOpen = true;
    }

    // ------------------- Owner / Pyth Setup -------------------
    function setPyth(address _pyth) external onlyOwner  {
        require(_pyth != address(0), "zero address");
        pyth = IPyth(_pyth);
        emit PythSet(_pyth);
    }

    function setPriceId(uint8 idx, bytes32 pid) external onlyOwner {
        require(idx < 2, "invalid index");
        options[idx].priceId = pid;
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

    function updatePriceFeeds(bytes[] calldata priceUpdateData) external payable isPythDefined {
        uint256 fee = pyth.getUpdateFee(priceUpdateData);
        require(msg.value >= fee, "insufficient fee");
        pyth.updatePriceFeeds{ value: fee }(priceUpdateData);
        if (msg.value > fee) payable(msg.sender).transfer(msg.value - fee);
    }

    // ------------------- Market Logic -------------------
    function buy(uint8 optionIndex, uint256 amount) external  isMarketOpen {
        require(optionIndex < 2, "invalid index");
        require(amount > 0, "zero amount");

        require(collateral.transferFrom(msg.sender, address(this), amount), "transfer failed");

        uint256 currentPrice = options[optionIndex].asset_price;
        uint256 tokensToMint = (amount * 1e18) / currentPrice;

        if (optionIndex == 0) {
            require(token0.balanceOf(address(this)) >= tokensToMint, "insufficient token0 supply");
            token0.transfer(msg.sender, tokensToMint);
            if (!addedParticipant[msg.sender]) { participants0.push(msg.sender); addedParticipant[msg.sender] = true; }
        } else {
            require(token1.balanceOf(address(this)) >= tokensToMint, "insufficient token1 supply");
            token1.transfer(msg.sender, tokensToMint);
            if (!addedParticipant[msg.sender]) { participants1.push(msg.sender); addedParticipant[msg.sender] = true; }
        }

        options[optionIndex].totalCollateral += amount;
        userCollateral[msg.sender][optionIndex] += amount;

        _recomputePrices();

        emit Bought(msg.sender, optionIndex, amount, options[optionIndex].asset_price);
    }

    function sell(uint8 optionIndex, uint256 tokenAmount) external  isMarketOpen {
        require(optionIndex < 2, "invalid index");
        require(tokenAmount > 0, "zero amount");

        if (optionIndex == 0) require(token0.balanceOf(msg.sender) >= tokenAmount, "insufficient token0 balance");
        else require(token1.balanceOf(msg.sender) >= tokenAmount, "insufficient token1 balance");

        uint256 price18 = options[optionIndex].asset_price;
        uint256 collateralOut = (tokenAmount * price18) / 1e18;

        require(collateral.balanceOf(address(this)) >= collateralOut, "insufficient collateral in contract");

        if (optionIndex == 0) {
            token0.transferFrom(msg.sender, address(this), tokenAmount);
            token0.burn(address(this), tokenAmount);
        } else {
            token1.transferFrom(msg.sender, address(this), tokenAmount);
            token1.burn(address(this), tokenAmount);
        }

        options[optionIndex].totalCollateral -= collateralOut;
        userCollateral[msg.sender][optionIndex] -= collateralOut;

        require(collateral.transfer(msg.sender, collateralOut), "payout failed");

        _recomputePrices();

        emit Sold(msg.sender, optionIndex, tokenAmount, collateralOut, options[optionIndex].asset_price);
    }

    // ------------------- Automatic Settlement -------------------
    /**
     * @notice Settles the futarchy market automatically.
     * Winner option holders are redeemed at current price.
     * Loser option tokens are burned; users lose staked collateral.
     * Only owner can call this function.
     */
    function settleMarket(bool isApproveWinner) external onlyOwner isMarketOpen {
    
        isOpen = false;

        uint8 winnerIndex = isApproveWinner ? 0 : 1;
        uint8 loserIndex  = isApproveWinner ? 1 : 0;

        uint256 winnerPrice = options[winnerIndex].asset_price;

        // Process winner: burn all tokens and pay collateral
        address[] storage winners = winnerIndex == 0 ? participants0 : participants1;
        for (uint i = 0; i < winners.length; i++) {
            address user = winners[i];
            uint256 tokenBalance = winnerIndex == 0 ? token0.balanceOf(user) : token1.balanceOf(user);
            if (tokenBalance > 0) {
                uint256 payout = (tokenBalance * winnerPrice) / 1e18;

                if (winnerIndex == 0) { token0.transferFrom(user, address(this), tokenBalance); token0.burn(address(this), tokenBalance); }
                else { token1.transferFrom(user, address(this), tokenBalance); token1.burn(address(this), tokenBalance); }

                require(collateral.transfer(user, payout), "payout failed");
                userCollateral[user][winnerIndex] = 0;
            }
        }

        // Process loser: burn tokens, return all collateral (losers don’t lose any)
        address[] storage losers = loserIndex == 0 ? participants0 : participants1;
        for (uint i = 0; i < losers.length; i++) {
            address user = losers[i];
            uint256 tokenBalance = loserIndex == 0 ? token0.balanceOf(user) : token1.balanceOf(user);

            // Burn all loser tokens
            if (tokenBalance > 0) {
                if (loserIndex == 0) { 
                    token0.transferFrom(user, address(this), tokenBalance); 
                    token0.burn(address(this), tokenBalance); 
                } else { 
                    token1.transferFrom(user, address(this), tokenBalance); 
                    token1.burn(address(this), tokenBalance); 
                }
            }

            // Return all collateral to user
            uint256 userCollat = userCollateral[user][loserIndex];
            if (userCollat > 0) {
                require(collateral.transfer(user, userCollat), "return collateral failed");
                userCollateral[user][loserIndex] = 0;
            }
        }


        emit MarketSettled(winnerIndex, loserIndex);
    }

    // ------------------- Price Recalculation -------------------
    function _recomputePrices() internal {
        uint256 ref0 = 1e18;
        uint256 ref1 = 1e18;

        if (address(pyth) != address(0)) {
            if (options[0].priceId != bytes32(0)) {
                (uint256 p0, uint t0) = getPythPrice(options[0].priceId);
                ref0 = p0;
                emit PriceRefreshed(0, p0, t0);
            }
            if (options[1].priceId != bytes32(0)) {
                (uint256 p1, uint t1) = getPythPrice(options[1].priceId);
                ref1 = p1;
                emit PriceRefreshed(1, p1, t1);
            }
        }

        uint256 totalCollateralAll = options[0].totalCollateral + options[1].totalCollateral + 1;

        uint256 share0 = (options[0].totalCollateral * 1e18) / totalCollateralAll;
        uint256 share1 = (options[1].totalCollateral * 1e18) / totalCollateralAll;

        uint256 mult0 = 1e18 + ((impactFactor * share0) / 1e18);
        uint256 mult1 = 1e18 + ((impactFactor * share1) / 1e18);

        options[0].asset_price = (ref0 * mult0) / 1e18;
        options[1].asset_price = (ref1 * mult1) / 1e18;
    }

    // ------------------- Views -------------------
    function getOptionPrice(uint8 idx) external view returns (uint256) {
        require(idx < 2, "invalid index");
        return options[idx].asset_price;
    }

    function getTotals() external view returns (uint256 tot0, uint256 tot1) {
        tot0 = options[0].totalCollateral;
        tot1 = options[1].totalCollateral;
    }
}
