// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20, SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMarketToken} from "../interfaces/IMarketToken.sol";

contract DutchAuction {
    using SafeERC20 for IERC20;

    IERC20 public immutable payUSD;             // payment token
    address public immutable subjectToken; 
    address public immutable marketToken;        // outcome token being sold (YES/NO)

    uint256 public immutable tStart;
    uint256 public immutable tEnd;                  
    uint256 public immutable basePrice;          // initial price of the subject token in PayUSD 
    uint256 public sold;                         // total minted
    uint256 public immutable minSupplySold;      // minimum sold to consider auction successful
    uint256 public immutable maxSupply;          // maximum sellable

    address public proposal;                     

    constructor() {}

    function initialize(
        IERC20 _payUSD,
        address _subjectToken,
        address _marketToken,
        uint256 _tStart,
        uint256 _tEnd,
        uint256 _basePrice,
        uint256 _minSupplySold,
        uint256 _maxSupply,
        address _proposal
        ) external {
        require(_tEnd > _tStart, "bad T");
        payUSD = _payUSD;
        subjectToken = _subjectToken;
        marketToken = _marketToken;
        tStart = _tStart;
        tEnd = _tEnd;
        basePrice = _basePrice;           
        minSupplySold = _minSupplySold;
        maxSupply = _maxSupply;
        proposal = _proposal;
    }

    function priceNow() public view returns (uint256) {
        // P(t) = 2 - (2t/T)  → price = basePrice * P(t)
        if (block.timestamp >= tEnd) return 0;
        uint256 T = tEnd - tStart;
        uint256 t = block.timestamp > tStart ? block.timestamp - tStart : 0;
        // compute (2 - 2t/T) in 1e18 fixed-point:
        // p = 2e18 - (2e18 * t / T)
        uint256 p = (2e18) - (2e18 * t / T);
        return (basePrice * p) / 1e18;
    }

    function buy(uint256 amountOutTokens, address receiver) external {
        require(block.timestamp >= tStart && block.timestamp <= tEnd, "inactive");
        require(sold + amountOutTokens <= maxSupply, "maxSupply");

        uint256 unitPrice = priceNow();                 // PayUSD per 1 token
        uint256 cost = unitPrice * amountOutTokens;     // asuma escalado en basePrice

        payUSD.safeTransferFrom(msg.sender, address(this), cost);
        token.mint(receiver, amountOutTokens);
        sold += amountOutTokens;
    }

    function funds() external view returns (uint256) {
        return payUSD.balanceOf(address(this));
    }


    function startAuction() external view returns (uint256) {
    }
}
