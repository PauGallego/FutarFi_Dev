// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Market} from "../src/Market.sol";
import {MarketToken} from "../src/MarketToken.sol";
import {TestERC20} from "./mocks/TestERC20.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {ProposalManagerTestBase} from "./ProposalManagerTestBase.t.sol";

contract MarketTest is ProposalManagerTestBase {

    Market m;
    Market m2;


    function setUp() public override {
        super.setUp();

        address clone = Clones.clone(address(marketImpl));

        m = Market(clone);

          m.initialize(
            collateralToken,
            100000000000 ether,
            address(0),     // pyth
            bytes32(""),
            address(marketTokenImpl)
        );


        // m2 = Market(clone);

        // m2.initialize(
        //     collateralToken,
        //     100000000000 ether,
        //     0x4305FB66699C3B2702D4d05CF36551390A4c69C6,     // pyth
        //     0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace,
        //     address(marketTokenImpl)
        // );
    }


    function testMarketTx() public {
        vm.startPrank(alice, alice);
        console.log(m.getMarketTypePrice(0));
        collateralToken.approve(address(m), 1 ether);
        m.buy(true, 1 ether);
        console.log(m.getMarketTypePrice(0));
        uint balance = m.approveToken().balanceOf(alice);
        uint256 tokensToSell = balance - (balance / 10);
        m.sell(true, tokensToSell);
        console.log(m.getMarketTypePrice(0));
    }

    // function testMarketTxOracle() public {

    //     vm.startPrank(alice, alice);
    //     console.log(m2.getMarketTypePrice(0));
    //     collateralToken.approve(address(m2), 1 ether);
    //     m2.buy(true, 1 ether);
    //     console.log(m2.getMarketTypePrice(0));
    //     uint balance = m2.approveToken().balanceOf(alice);
    //     uint256 tokensToSell = balance - (balance / 10);
    //     m2.sell(true, tokensToSell);
    //     console.log(m2.getMarketTypePrice(0));
    // }

}
