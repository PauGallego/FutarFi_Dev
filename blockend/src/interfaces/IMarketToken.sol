// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";


interface IMarketToken is IERC20 {
    function initialize(string memory _name, string memory _symbol) external;
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}