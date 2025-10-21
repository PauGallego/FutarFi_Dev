// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";


contract Treasury is Ownable {
    using SafeERC20 for IERC20;
    address public immutable pyUSD;
    address public yesAuction;
    address public noAuction;

    uint256 public potYes;
    uint256 public potNo;
    uint256 public fees6d;

    error NotAuction();

    event FundedFromAuction(address indexed auction, address indexed payer, uint256 amount);


    constructor(address _pyUSD) Ownable(msg.sender) { 
        pyUSD = _pyUSD; 
    }

    function setAuctions(address _yes, address _no) external onlyOwner {
        yesAuction = _yes; 
        noAuction = _no;
    }

    function fundFromAuction(address payer, uint256 amount) external {
        if (msg.sender == yesAuction)      potYes += amount;
        else if (msg.sender == noAuction)  potNo  += amount;
        else revert NotAuction();

        IERC20(pyUSD).safeTransferFrom(payer, address(this), amount);
        emit FundedFromAuction(msg.sender, payer, amount);
    }

}
