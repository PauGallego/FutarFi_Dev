// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MarketToken} from "../tokens/MarketToken.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface ITreasury {
    function fundFromAuction(address payer, uint256 amount) external;
}

/// @notice Buyer supplies PYUSD and receives YES/NO tokens at the linear price at that moment.
/// @dev Collects PYUSD into Treasury and mints tokens to the buyer (mint-on-buy).
contract DutchAuction is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;


    address       public immutable pyUSD;      // PYUSD token
    MarketToken   public immutable marketToken;    // YES/NO token, in constructor we decide which one this auction is for
    address       public immutable treasury;

    uint256 public immutable startTime;           // auction start
    uint256 public immutable endTime;             // auction end
    uint256 public immutable priceStart;       // starting price (PYUSD 6d per 1 token)
    uint256 public constant priceEnd = 0;
    uint256 public immutable minToOpen;        // marketToken sold threshold to open market    

    bool    public finalized;

    // ---------------- Errors ----------------
    error NotLive();
    error AlreadyFinalized();
    error AmountZero();
    error PriceZero();
    error ZeroAddress();
    error InvalidToken();
    error OverCap();

    // ---------------- Events ----------------
    event LiquidityAdded(
        address indexed buyer,
        address indexed tokenToBuy,
        uint256 _payAmount,
        uint256 unitPrice,
        uint256 tokensOut
    );
    event Finalized();

    constructor(
        address _pyUSD,
        address _marketToken,
        address _treasury,
        uint256 _duration,
        uint256 _priceStart,
        uint256 _minToOpen
    ) Ownable(msg.sender) {
        require(_priceStart >= 0, "bad prices"); 
        pyUSD    = _pyUSD;
        marketToken  = MarketToken(_marketToken);
        treasury  = _treasury;
        startTime    = block.timestamp;
        endTime      = block.timestamp + _duration;
        priceStart   = _priceStart;
        minToOpen    = _minToOpen;

    }


    // ---------------- Helpers ----------------

    function _isLive() internal view returns (bool) {
        return block.timestamp >= startTime && block.timestamp <= endTime && !finalized;
    }


    /// @notice Current price (PYUSD, 6 decimals) per 1 token
    function priceNow() public view returns (uint256) {
        uint256 ts = block.timestamp;
        if (ts <= startTime) return priceStart;
        if (ts >= endTime)   return priceEnd;
        uint256 dt   = endTime - startTime;
        uint256 gone = ts - startTime;
        uint256 diff = priceStart - priceEnd;
        return priceStart - (diff * gone) / dt;
    }

   

    /// @notice Buyer specifies how much PYUSD to spend and receives tokens at the current price.
    /// @param _payAmount  PYUSD to spend (6 decimals)
    function buyLiquidity(
        uint256 _payAmount
    ) external nonReentrant {
        if (!_isLive()) revert NotLive();
        if (msg.sender == address(0)) revert ZeroAddress();
        if (_payAmount == 0) revert AmountZero();

        if (block.timestamp >= endTime){
            if (marketToken.totalSupply() >= minToOpen) {
                _finalize();
            }
        } 

        uint256 actualPrice = priceNow();
        if (actualPrice == 0) revert PriceZero();

        // tokens = payAmount / price per token
        uint256 tokensOut = (_payAmount * 1e18) / actualPrice;

        // future permit implementation
        // pyUSD.permit(
        //     msg.sender,
        //     treasury,
        //     _payAmount,
        //     permit.deadline,
        //     permit.v,
        //     permit.r,
        //     permit.s
        // );

        ITreasury(treasury).fundFromAuction(msg.sender, _payAmount);
        marketToken.mint(msg.sender, tokensOut);
        emit LiquidityAdded(msg.sender, address(marketToken), _payAmount, actualPrice, tokensOut);

        if (marketToken.totalSupply() + tokensOut == marketToken.cap()) _finalize();
        
    }


    function finalize() external onlyOwner {
        if (marketToken.totalSupply() == marketToken.cap()) _finalize();
    }

    /// @notice Close the auction. 
    function _finalize() private {
        if (finalized) revert AlreadyFinalized();
        finalized = true;
        emit Finalized();
    }
}
