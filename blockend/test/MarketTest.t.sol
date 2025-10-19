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

        
    }


    // Test Case 1: Approve side wins - Both Alice and Bob have positions on both sides
    function testSettleMarket_ApproveWins_BothSidesTrading() public {
        // Alice buys both approve and reject tokens
        vm.startPrank(alice);
        collateralToken.approve(address(m), 15 ether);
        m.buy(true, 10 ether);   // Alice buys approve tokens (winner side)
        m.buy(false, 5 ether);   // Alice also buys reject tokens (loser side)
        uint256 aliceApproveTokens = MarketToken(m.approveToken()).balanceOf(alice);
        uint256 aliceRejectTokens = MarketToken(m.rejectToken()).balanceOf(alice);
        vm.stopPrank();

        // Bob also buys both approve and reject tokens
        vm.startPrank(bob);
        collateralToken.approve(address(m), 12 ether);
        m.buy(true, 4 ether);    // Bob buys approve tokens (winner side)
        m.buy(false, 8 ether);   // Bob buys more reject tokens (loser side)
        uint256 bobApproveTokens = MarketToken(m.approveToken()).balanceOf(bob);
        uint256 bobRejectTokens = MarketToken(m.rejectToken()).balanceOf(bob);
        vm.stopPrank();

        // Record balances before settlement
        uint256 aliceInitialCollateral = collateralToken.balanceOf(alice);
        uint256 bobInitialCollateral = collateralToken.balanceOf(bob);
        uint256 approvePrice = m.getMarketTypePrice(0);

        console.log("=== APPROVE SIDE WINS TEST ===");
        console.log("Alice approve tokens:", aliceApproveTokens);
        console.log("Alice reject tokens:", aliceRejectTokens);
        console.log("Bob approve tokens:", bobApproveTokens);
        console.log("Bob reject tokens:", bobRejectTokens);
        console.log("Approve token price:", approvePrice);

        // Settle market with approve side winning
        vm.prank(deployer);
        m.settleMarket(true);

        // Check final balances
        uint256 aliceFinalCollateral = collateralToken.balanceOf(alice);
        uint256 bobFinalCollateral = collateralToken.balanceOf(bob);

        // Calculate expected payouts and returns
        uint256 expectedAliceWinnings = (aliceApproveTokens * approvePrice) / 1e18;
        uint256 expectedAliceReturns = 5 ether; // Original reject tokens investment
        uint256 expectedBobWinnings = (bobApproveTokens * approvePrice) / 1e18;
        uint256 expectedBobReturns = 8 ether; // Original reject tokens investment

        // Verify final balances (winnings from approve + returned reject collateral)
        assertEq(aliceFinalCollateral, aliceInitialCollateral + expectedAliceWinnings + expectedAliceReturns, 
                "Alice should get approve winnings + reject collateral back");
        assertEq(bobFinalCollateral, bobInitialCollateral + expectedBobWinnings + expectedBobReturns, 
                "Bob should get approve winnings + reject collateral back");

        // All tokens should be burned
        assertEq(MarketToken(m.approveToken()).balanceOf(alice), 0, "Alice's approve tokens should be burned");
        assertEq(MarketToken(m.rejectToken()).balanceOf(alice), 0, "Alice's reject tokens should be burned");
        assertEq(MarketToken(m.approveToken()).balanceOf(bob), 0, "Bob's approve tokens should be burned");
        assertEq(MarketToken(m.rejectToken()).balanceOf(bob), 0, "Bob's reject tokens should be burned");

        console.log("Alice final balance:", aliceFinalCollateral);
        console.log("Bob final balance:", bobFinalCollateral);
    }

    // Test Case 2: Reject side wins - Both Alice and Bob have positions on both sides
    function testSettleMarket_RejectWins_BothSidesTrading() public {
        // Alice buys both approve and reject tokens
        vm.startPrank(alice);
        collateralToken.approve(address(m), 13 ether);
        m.buy(true, 6 ether);    // Alice buys approve tokens (loser side)
        m.buy(false, 7 ether);   // Alice buys reject tokens (winner side)
        uint256 aliceApproveTokens = MarketToken(m.approveToken()).balanceOf(alice);
        uint256 aliceRejectTokens = MarketToken(m.rejectToken()).balanceOf(alice);
        vm.stopPrank();

        // Bob also buys both approve and reject tokens
        vm.startPrank(bob);
        collateralToken.approve(address(m), 14 ether);
        m.buy(true, 9 ether);    // Bob buys approve tokens (loser side)
        m.buy(false, 5 ether);   // Bob buys reject tokens (winner side)
        uint256 bobApproveTokens = MarketToken(m.approveToken()).balanceOf(bob);
        uint256 bobRejectTokens = MarketToken(m.rejectToken()).balanceOf(bob);
        vm.stopPrank();

        // Record balances before settlement
        uint256 aliceInitialCollateral = collateralToken.balanceOf(alice);
        uint256 bobInitialCollateral = collateralToken.balanceOf(bob);
        uint256 rejectPrice = m.getMarketTypePrice(1);

        console.log("=== REJECT SIDE WINS TEST ===");
        console.log("Alice approve tokens:", aliceApproveTokens);
        console.log("Alice reject tokens:", aliceRejectTokens);
        console.log("Bob approve tokens:", bobApproveTokens);
        console.log("Bob reject tokens:", bobRejectTokens);
        console.log("Reject token price:", rejectPrice);

        // Settle market with reject side winning
        vm.prank(deployer);
        m.settleMarket(false);

        // Check final balances
        uint256 aliceFinalCollateral = collateralToken.balanceOf(alice);
        uint256 bobFinalCollateral = collateralToken.balanceOf(bob);

        // Calculate expected payouts and returns
        uint256 expectedAliceWinnings = (aliceRejectTokens * rejectPrice) / 1e18;
        uint256 expectedAliceReturns = 6 ether; // Original approve tokens investment
        uint256 expectedBobWinnings = (bobRejectTokens * rejectPrice) / 1e18;
        uint256 expectedBobReturns = 9 ether; // Original approve tokens investment

        // Verify final balances (winnings from reject + returned approve collateral)
        assertEq(aliceFinalCollateral, aliceInitialCollateral + expectedAliceWinnings + expectedAliceReturns, 
                "Alice should get reject winnings + approve collateral back");
        assertEq(bobFinalCollateral, bobInitialCollateral + expectedBobWinnings + expectedBobReturns, 
                "Bob should get reject winnings + approve collateral back");

        // All tokens should be burned
        assertEq(MarketToken(m.approveToken()).balanceOf(alice), 0, "Alice's approve tokens should be burned");
        assertEq(MarketToken(m.rejectToken()).balanceOf(alice), 0, "Alice's reject tokens should be burned");
        assertEq(MarketToken(m.approveToken()).balanceOf(bob), 0, "Bob's approve tokens should be burned");
        assertEq(MarketToken(m.rejectToken()).balanceOf(bob), 0, "Bob's reject tokens should be burned");

        console.log("Alice final balance:", aliceFinalCollateral);
        console.log("Bob final balance:", bobFinalCollateral);
    }

}
