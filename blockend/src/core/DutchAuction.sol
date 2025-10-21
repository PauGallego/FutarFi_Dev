// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MarketToken} from "../tokens/MarketToken.sol";
 
interface ITreasury {
    function fundFromAuction(address payer, uint256 amount) external;
}

/// @notice Buyer supplies PYUSD and receives YES/NO tokens at the linear price at that moment.
/// @dev Collects PYUSD into Treasury and mints tokens to the buyer (mint-on-buy).
contract DutchAuction is ReentrancyGuard {
    using SafeERC20 for IERC20;


    address       public immutable pyUSD;      // PYUSD token (6 decimals)
    address       public immutable tokenYes;    // 18 decimals
    address       public immutable tokenNo;     // 18 decimals
    address       public immutable treasury;

    uint256 public immutable tStart;           // auction start
    uint256 public immutable tEnd;             // auction end
    uint256 public immutable priceStart;       // starting price (PYUSD 6d per 1 token)
    uint256 public constant priceEnd = 0;    

    // ---------------- Metrics ----------------
    uint256 public soldYes;
    uint256 public soldNo;
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
        address _tokenYes,
        address _tokenNo,
        address _treasury,
        uint256 _tStart,
        uint256 _tEnd,
        uint256 _priceStart
    ) {
        if (
            _pyUSD   == address(0) ||
            _tokenYes == address(0) ||
            _tokenNo  == address(0) ||
            _treasury == address(0)
        ) revert ZeroAddress();
        if (_tEnd <= _tStart) revert NotLive();
        require(_priceStart >= 0, "bad prices"); 

        pyUSD    = _pyUSD;
        tokenYes  = _tokenYes;
        tokenNo   = _tokenNo;
        treasury  = _treasury;
        tStart    = _tStart;
        tEnd      = _tEnd;

    }

    // ---------------- Helpers ----------------

    function _isLive() internal view returns (bool) {
        return block.timestamp >= tStart && block.timestamp <= tEnd && !finalized;
    }


    /// @notice Current price (PYUSD, 6 decimals) per 1 token
    function priceNow() public view returns (uint256) {
        uint256 ts = block.timestamp;
        if (ts <= tStart) return priceStart;
        if (ts >= tEnd)   return priceEnd;
        uint256 dt   = tEnd - tStart;
        uint256 gone = ts - tStart;
        uint256 diff = priceStart - priceEnd;
        return priceStart - (diff * gone) / dt;
    }

   

    /// @notice Buyer specifies how much PYUSD to spend and receives tokens at the current price.
    /// @param _tokenToBuy         YES or NO
    /// @param _payAmount  PYUSD to spend (6 decimals)
    function buyLiquidity(
        address _tokenToBuy,
        uint256 _payAmount
    ) external nonReentrant {
        if (!_isLive()) revert NotLive();
        if (msg.sender == address(0)) revert ZeroAddress();
        if (_payAmount == 0) revert AmountZero();
        if (_tokenToBuy != tokenYes &&  _tokenToBuy != tokenNo) revert InvalidToken();

        uint256 actualPrice = priceNow();
        if (actualPrice == 0) revert PriceZero();

        // tokens = pay / price
        uint256 tokensOut = (_payAmount * 1e18) / actualPrice;

        MarketToken t = MarketToken(_tokenToBuy);

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
        t.mint(msg.sender, tokensOut);

        // Metrics
        if (_tokenToBuy == tokenYes) soldYes += tokensOut;
        else soldNo  += tokensOut;

        emit LiquidityAdded(msg.sender, _tokenToBuy, _payAmount, actualPrice, tokensOut);
    }

    // ---------------- Finalization ----------------

    /// @notice Close the auction. (You may restrict this to Proposal if desired)
    function finalize() external {
        if (finalized) revert AlreadyFinalized();
        if (block.timestamp < tEnd) revert NotLive();
        finalized = true;
        emit Finalized();
    }
}
