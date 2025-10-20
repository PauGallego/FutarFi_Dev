// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MarketToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    address public minter;
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    constructor(string memory name_, string memory symbol_, address owner_, address minter_)
        ERC20(name_, symbol_) ERC20Permit(name_) Ownable(owner_) 
    { 
        require(minter_ != address(0), "minter=0"); 
        minter = minter_; 
    }

    function decimals() public pure override returns (uint8) { return 18; }
    function setMinter(address m) external onlyOwner { require(m!=address(0)); emit MinterUpdated(minter,m); minter=m; }
    function mint(address to, uint256 amt) external { require(msg.sender==minter, "not-minter"); _mint(to, amt); }
}
