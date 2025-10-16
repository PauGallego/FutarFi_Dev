// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;

import {console} from "forge-std/Test.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ProposalManagerTestBase} from "./ProposalManagerTestBase.t.sol";
import {Market} from "../src/Market.sol";

contract MarketTest is ProposalManagerTestBase {

    Market market;

    function setUp() public override{
    super.setUp();
    market = new Market(
        collateralToken,
        "ApproveToken",
        "APP",
        "RejectToken",
        "REJ",
        10000000000 ether,
        0x4305FB66699C3B2702D4d05CF36551390A4c69C6, // Pyth contract address
        0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace  // bytes32 feed ID, eth in this case 

    );

}


    //Basic Slippage Testing 
    function testMarketTx() public {
        vm.startPrank(user1, user1);
        console.log(market.getOptionPrice(0));
        collateralToken.approve(address(market), 1 ether);

        
        market.buy(true, 1 ether);
        console.log(market.getOptionPrice(0));
        uint balance = market.tokenApprove().balanceOf(user1);
        uint256 tokensToSell = balance - (balance / 10); 
        market.sell(true, tokensToSell);
        console.log(market.getOptionPrice(0));
    }


}

