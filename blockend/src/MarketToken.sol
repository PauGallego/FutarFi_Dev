// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "openzeppelin-contracts/contracts/access/Ownable.sol";

interface IMarketToken is IERC20 {
    function initialize(string memory _name, string memory _symbol) external;
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
}

contract MarketToken is IMarketToken, Ownable {
    bool private _initialized;

    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 private _totalSupply;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    constructor() Ownable(msg.sender) {}

    function initialize(string memory _name, string memory _symbol) external {
        require(!_initialized, "Already initialized");
        _initialized = true;
        name = _name;
        symbol = _symbol;
        _transferOwnership(msg.sender); // proxy owner = market
    }

    // --- ERC20 ---
    function totalSupply() external view override returns (uint256) { return _totalSupply; }
    function balanceOf(address a) external view override returns (uint256) { return _balances[a]; }

    function allowance(address o, address s) external view override returns (uint256) {
        return _allowances[o][s];
    }
    function approve(address s, uint256 a) external override returns (bool) {
        _allowances[msg.sender][s] = a; return true;
    }
    function transfer(address to, uint256 a) external override returns (bool) {
        _transfer(msg.sender, to, a); return true;
    }
    function transferFrom(address from, address to, uint256 a) external override returns (bool) {
        uint256 alw = _allowances[from][msg.sender];
        require(alw >= a, "insufficient allowance");
        _allowances[from][msg.sender] = alw - a;
        _transfer(from, to, a); return true;
    }

    // --- Controlled supply (owner = Market) ---
    function mint(address to, uint256 a) external override onlyOwner {
        _totalSupply += a; _balances[to] += a;
    }
    function burn(address from, uint256 a) external override onlyOwner {
        require(_balances[from] >= a, "burn exceeds balance");
        _balances[from] -= a; _totalSupply -= a;
    }

    // --- internal ---
    function _transfer(address from, address to, uint256 a) internal {
        require(to != address(0), "transfer to zero");
        require(_balances[from] >= a, "insufficient balance");
        _balances[from] -= a; _balances[to] += a;
    }
}
