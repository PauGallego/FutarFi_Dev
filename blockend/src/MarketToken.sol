// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";


contract MarketToken is IERC20, Ownable {

    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;

    constructor(string memory _name, string memory _symbol) Ownable(msg.sender) {
        name = _name;
        symbol = _symbol;
    }

    // IERC20 totalSupply
    function totalSupply() external view override returns (uint256) {
        return _totalSupply;
    }

    // IERC20 balanceOf
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }

    // Only owner can mint tokens
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Mint to zero address");
        _balances[to] += amount;
        _totalSupply += amount;
    }

    // Only owner can burn tokens
    function burn(address from, uint256 amount) external onlyOwner {
        require(from != address(0), "Burn from zero address");
        require(_balances[from] >= amount, "Burn amount exceeds balance");
        _balances[from] -= amount;
        _totalSupply -= amount;
    }

    // Simple transfer between users if needed
    function transfer(address to, uint256 amount) external override returns (bool) {
        require(to != address(0), "Transfer to zero address");
        require(_balances[msg.sender] >= amount, "Insufficient balance");
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        return true;
    }

    // Optional: no allowance/approve logic if transfers are only simple
    function allowance(address, address) external pure override returns (uint256) { return 0; }
    function approve(address, uint256) external pure override returns (bool) { return false; }
    function transferFrom(address, address, uint256) external pure override returns (bool) { return false; }
}
