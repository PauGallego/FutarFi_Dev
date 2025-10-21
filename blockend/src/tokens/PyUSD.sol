// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract PyUSD is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    function decimals() public pure override returns (uint8) { return 6; }
    string constant name = "PayPal USD";
    string constant symbol = "PYUSD";

    constructor(address initialOwner, uint256 initialSupply)
        ERC20(name, symbol)
        ERC20Permit(symbol)
        Ownable(initialOwner)
    {
        if (initialSupply > 0) _mint(initialOwner, initialSupply);
    }

    function mint(address to, uint256 amount) external onlyOwner { _mint(to, amount); }
}
