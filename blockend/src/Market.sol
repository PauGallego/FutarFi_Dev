// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {MarketToken} from "./MarketToken.sol";

interface IMarket {
    function openMarket() external;
    function closeMarket() external;
    function deposit(uint256 amount, bool isAprove) external;
    function settleMarket(bool isAproveWinner) external;
    function getUserInfo(address user) external view returns(uint256 collat, uint256 aprove, uint256 reject);
    function remainingAprove() external view returns(uint256);
    function remainingReject() external view returns(uint256);
}

contract Market is Ownable {

    // Market params
    uint256 public base_fee;
    bool public isOpen;
    IERC20 public collateral;

    // Vault tokens
    MarketToken public TokenAprove;     
    MarketToken public TokenReject;     
    uint256 public maxSupply;  

    //Price
    struct MarketOption {
        bool typeofmarket; 
        uint256 asset_price;
    }

    MarketOption[] public options = new MarketOption[](2);

    // User balances
    mapping(address => uint256) public collateralBalances;
    mapping(address => uint256) public aproveBalances;
    mapping(address => uint256) public rejectBalances;
    address[] public users;

    constructor(
        uint256 _base_fee,
        IERC20 _collateral,
        string memory _aproveName,
        string memory _aproveSymbol,
        string memory _rejectName,
        string memory _rejectSymbol,
        uint256 _maxSupply
    ) Ownable(msg.sender) {
        base_fee = _base_fee;
        collateral = _collateral;

        TokenAprove = new MarketToken(_aproveName, _aproveSymbol);
        TokenReject = new MarketToken(_rejectName, _rejectSymbol);

        TokenAprove.mint(address(this), _maxSupply);
        TokenReject.mint(address(this), _maxSupply);

        //TODO: Dynamic options and prices
        options[0] = MarketOption(true, 1);
        options[1] = MarketOption(false, 1);

        maxSupply = _maxSupply;
        isOpen = false;

    }

    // Market control
    function openMarket() external onlyOwner {
        require(!isOpen, "Market already open");
        isOpen = true;
    }

    function closeMarket() external onlyOwner {
        require(isOpen, "Market already closed");
        isOpen = false;
    }

    // Deposits with collateral not counting price, only 1:1 for simplicity at this moment
    function deposit(uint256 amount, bool isAprove) external {
        require(isOpen, "Market is closed");
        require(amount > 0, "Amount must be > 0");

        require(collateral.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        if(isAprove){
            require(TokenAprove.balanceOf(address(this)) >= amount, "Not enough TokenAprove left");
            TokenAprove.transfer(msg.sender, amount);
            aproveBalances[msg.sender] += amount;
        } else {
            require(TokenReject.balanceOf(address(this)) >= amount, "Not enough TokenReject left");
            TokenReject.transfer(msg.sender, amount);
            rejectBalances[msg.sender] += amount;
        }

        collateralBalances[msg.sender] += amount;

        if(collateralBalances[msg.sender] == amount){
            users.push(msg.sender);
        }
    }

    //TODO buy and sell functions with price impact 

    // Settlement
    function settleMarket(bool isAproveWinner) external onlyOwner {
        require(!isOpen, "Market already settled");
        isOpen = false;

        if(isAproveWinner){
            _revertSide(false); // revert TokenReject
            _prepareWinners(true);
        } else {
            _revertSide(true); // revert TokenAprove
            _prepareWinners(false);
        }
    }

    function _revertSide(bool isAprove) internal {
        for(uint256 i=0; i<users.length; i++){
            address user = users[i];
            if(isAprove){
                uint256 aprove = aproveBalances[user];
                if(aprove>0){
                    TokenAprove.burn(user, aprove);
                    aproveBalances[user] = 0;
                    uint256 collat = collateralBalances[user];
                    collateralBalances[user] = 0;
                    require(collateral.transfer(user, collat), "Collateral return failed");
                }
            } else {
                uint256 reject = rejectBalances[user];
                if(reject>0){
                    TokenReject.burn(user, reject);
                    rejectBalances[user] = 0;
                    uint256 collat = collateralBalances[user];
                    collateralBalances[user] = 0;
                    require(collateral.transfer(user, collat), "Collateral return failed");
                }
            }
        }
    }

    function changePrice(bool isAprove, uint256 newPrice) external onlyOwner {
        if(isAprove){
           options[0].asset_price = newPrice;
        } else {
            options[1].asset_price = newPrice;
        }
    }

    function _prepareWinners(bool isAproveWinner) internal {
        // Placeholder for future winner logic taking fees and price into account
    }

  

    // Views
    function getUserInfo(address user) external view returns(uint256 collat, uint256 aprove, uint256 reject){
        return (collateralBalances[user], aproveBalances[user], rejectBalances[user]);
    }

    function remainingAprove() external view returns(uint256){
        return TokenAprove.balanceOf(address(this));
    }

    function remainingReject() external view returns(uint256){
        return TokenReject.balanceOf(address(this));
    }
}
