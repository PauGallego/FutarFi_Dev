// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract TestERC20 is ERC20 {
    constructor() ERC20("TestToken", "TTK") {
        _mint(msg.sender, type(uint256).max);
    }
}