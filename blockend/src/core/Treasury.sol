// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


contract Treasury is Ownable {
    using SafeERC20 for IERC20;
    address public immutable payUSD;
    address public auctionYes;
    address public auctionNo;

    uint256 public potYes6d;
    uint256 public potNo6d;
    uint256 public fees6d;

    error NotAuction();

    event FundedFromAuction(address indexed auction, address indexed payer, uint256 amount6d);


    constructor(address _payUSD) Ownable(msg.sender) { 
        payUSD = _payUSD; 
    }

    function setAuctions(address _yes, address _no) external onlyOwner {
        auctionYes = _yes; 
        auctionNo = _no;
    }

    function fundFromAuction(address payer, uint256 amount6d) external {
        if (msg.sender == auctionYes)      potYes6d += amount6d;
        else if (msg.sender == auctionNo)  potNo6d  += amount6d;
        else revert NotAuction();

        IERC20(payUSD).safeTransferFrom(payer, address(this), amount6d);
        emit FundedFromAuction(msg.sender, payer, amount6d);
    }

    /// @notice Fees are 0.15% of the contract's current payUSD balance.
    /// @dev 0.15% = 15 / 10000. This reads the token balance held by this contract
    function fundFromFees() external onlyOwner {
        uint256 balance = IERC20(payUSD).balanceOf(address(this));
        uint256 fee = (balance * 15) / 10000; // 0.15%
        fees6d = fee;
    }
}
