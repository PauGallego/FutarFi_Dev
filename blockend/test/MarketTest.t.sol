// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;


// import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
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
            10000 ether,
            address(0),
            bytes32(""),
            bytes32("")
        );
       
    }

    function testMarketTx() public {
        vm.startPrank(user1, user1);

        (uint256 previousTotalSupply,) = market.totalSupply();
        (uint256 previousCollateralTotalSupply,) = market.totalCollateralSupply();
        uint256 previousCollateralBalanceUser = market.userCollateral(user1, 0);
        uint256 previousBalanceUser1 = collateralToken.balanceOf(user1);

        collateralToken.approve(address(market), 1 ether);
        market.buy(true, 1 ether);

        (uint256 newTotalSupply,) = market.totalSupply();
        (uint256 newCollateralTotalSupply,) = market.totalCollateralSupply();
        assertEq(newTotalSupply, previousTotalSupply - 1 ether, "total supply should decrease by 1 ether");
        assertEq(newCollateralTotalSupply, previousCollateralTotalSupply + 1 ether, "collateral total supply should increase by 1 ether");
        assertEq(market.userCollateral(user1, 0), previousCollateralBalanceUser + 1 ether, "user collateral should increase by 1 ether");
        assertEq(collateralToken.balanceOf(user1), previousBalanceUser1 - 1 ether, "user balance should decrease by 1 ether");

    }


    

}

