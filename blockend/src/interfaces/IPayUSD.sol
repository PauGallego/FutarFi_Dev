// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal PayUSD interface 
interface IPayUSD is IERC20 {
    function decimals() external view returns (uint8);
    function mint(address to, uint256 amount) external;
}
