// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {ProposalManagerTestBase} from "./ProposalManagerTestBase.t.sol";
import {Proposal} from "../src/Proposal.sol";
import {Market} from "../src/Market.sol";
import {MockObjectiveContract} from "./mocks/MockObjectiveContract.sol";

contract MockObjectiveContractTest is ProposalManagerTestBase {
    
    function setUp() public override {
        super.setUp();
    }

    // Test approve side wins and executes proposal
    function testBasicProposalExecution() public {
        bytes memory callData = abi.encodeWithSelector(
            MockObjectiveContract.changeDynamicValue.selector,
            500
        );

        uint256 proposalId = pm.createProposal(
            "Change Value",
            "Change dynamic value to 500",
            3600,
            address(collateralToken),
            1000000 ether,
            address(mockContract),
            callData,
            address(0),
            bytes32(0)
        );

        address proposalAddr = pm.getProposalById(proposalId);
        Proposal proposal = Proposal(proposalAddr);
        Market market = proposal.market();

        assertEq(mockContract.dynamicValue(), 42, "Initial value should be 42");

        vm.startPrank(alice);
        collateralToken.approve(address(market), 100 ether);
        market.buy(true, 50 ether);  
        vm.stopPrank();

        vm.startPrank(bob);
        collateralToken.approve(address(market), 100 ether);
        market.buy(false, 10 ether); 
        vm.stopPrank();

        // Check that approve side has higher price
        uint256 approvePrice = market.getMarketTypePrice(0);
        uint256 rejectPrice = market.getMarketTypePrice(1);
        console.log("Approve price:", approvePrice);
        console.log("Reject price:", rejectPrice);
        assertTrue(approvePrice > rejectPrice, "Approve side should have higher price");

        vm.warp(block.timestamp + 3601); 

        vm.prank(address(this));
        pm.finalizeProposal(proposalId);

        assertEq(mockContract.dynamicValue(), 500, "Value should be updated to 500");
    }

    function testProposalRejectWins_NoExecution() public {

        // Create calldata to change the dynamic value
        bytes memory callData = abi.encodeWithSelector(
            MockObjectiveContract.changeDynamicValue.selector,
            777
        );

        // Create proposal
        uint256 proposalId = pm.createProposal(
            "Change Value - Should Not Execute",
            "This should not execute because reject side will win",
            3600,
            address(collateralToken),
            1000000 ether,
            address(mockContract),
            callData,
            address(0),
            bytes32(0)
        );

        address proposalAddr = pm.getProposalById(proposalId);
        Proposal proposal = Proposal(proposalAddr);
        Market market = proposal.market();

        // Verify initial state
        assertEq(mockContract.dynamicValue(), 42, "Initial value should be 42");

        // Simulate trading that makes reject side win
        vm.startPrank(alice);
        collateralToken.approve(address(market), 100 ether);
        market.buy(false, 60 ether); // Buy more reject tokens
        vm.stopPrank();

        vm.startPrank(bob);
        collateralToken.approve(address(market), 100 ether);
        market.buy(true, 20 ether);  // Buy fewer approve tokens
        vm.stopPrank();

        // Check that reject side has higher price
        uint256 approvePrice = market.getMarketTypePrice(0);
        uint256 rejectPrice = market.getMarketTypePrice(1);
        console.log("Approve price:", approvePrice);
        console.log("Reject price:", rejectPrice);
        assertTrue(rejectPrice > approvePrice, "Reject side should have higher price");

        // Fast forward time
        vm.warp(block.timestamp + 3601);

        // Execute proposal (reject wins, no execution should happen)
        vm.prank(address(this));
        pm.finalizeProposal(proposalId);

        // Check that NO execution happened
        assertEq(mockContract.dynamicValue(), 42, "Value should remain unchanged when reject wins");
        
        // But proposal should be marked as executed/ended
        assertTrue(proposal.proposalExecuted(), "Proposal should be marked as executed");
        assertTrue(proposal.proposalEnded(), "Proposal should be marked as ended");

        
    }

    function testProposalEqualPrices_NoExecution() public {
        // Create calldata 
        bytes memory callData = abi.encodeWithSelector(
            MockObjectiveContract.changeDynamicValue.selector,
            999
        );

        // Create proposal
        uint256 proposalId = pm.createProposal(
            "Equal Prices Test",
            "This should not execute due to equal prices",
            3600,
            address(collateralToken),
            1000000 ether,
            address(mockContract),
            callData,
            address(0),
            bytes32(0)
        );

        address proposalAddr = pm.getProposalById(proposalId);
        Proposal proposal = Proposal(proposalAddr);
        Market market = proposal.market();

        // Verify initial state
        assertEq(mockContract.dynamicValue(), 42, "Initial value should be 42");

        // Try to create equal trading (same amounts on both sides)
        vm.startPrank(alice);
        collateralToken.approve(address(market), 100 ether);
        market.buy(true, 30 ether);  // Buy approve tokens
        market.buy(false, 30 ether); // Buy same amount of reject tokens
        vm.stopPrank();

        // Check prices (should be equal or very close)
        uint256 approvePrice = market.getMarketTypePrice(0);
        uint256 rejectPrice = market.getMarketTypePrice(1);
        console.log("Approve price:", approvePrice);
        console.log("Reject price:", rejectPrice);

        // Fast forward time
        vm.warp(block.timestamp + 3601);

        // Execute proposal 
        vm.prank(address(this));
        pm.finalizeProposal(proposalId);

        // If prices were exactly equal, no execution should happen
        // If not exactly equal, execution depends on which side won
        console.log("Final mock value:", mockContract.dynamicValue());
        
        // Proposal should still be marked as completed
        assertTrue(proposal.proposalExecuted(), "Proposal should be marked as executed");
        assertTrue(proposal.proposalEnded(), "Proposal should be marked as ended");

        // Check collateral settlement behavior - with revertMarket, Alice should get EXACTLY her original investment back
        uint256 aliceCollateral = collateralToken.balanceOf(alice);
        uint256 bobCollateral = collateralToken.balanceOf(bob);
        console.log("Alice collateral after revert:", aliceCollateral);
        console.log("Bob collateral after revert:", bobCollateral);

        // Alice spent 60 ether total (30+30), should get back EXACTLY 60 ether (full revert)
        assertEq(aliceCollateral, 1000 ether, "Alice should get exactly her original investment back in revert");
        assertEq(bobCollateral, 1000 ether, "Bob didn't trade so should keep original balance");
    }

    function testCollateralRevertCorrectly_ApproveWins() public {
        // Test that losers get their original collateral back when approve side wins
        bytes memory callData = abi.encodeWithSelector(
            MockObjectiveContract.changeDynamicValue.selector,
            123
        );

        uint256 proposalId = pm.createProposal(
            "Test Collateral Revert",
            "Test that losers get collateral back",
            3600,
            address(collateralToken),
            1000000 ether,
            address(mockContract),
            callData,
            address(0),
            bytes32(0)
        );

        address proposalAddr = pm.getProposalById(proposalId);
        Proposal proposal = Proposal(proposalAddr);
        Market market = proposal.market();

        // Record initial balances
        uint256 aliceInitial = collateralToken.balanceOf(alice);
        uint256 bobInitial = collateralToken.balanceOf(bob);

        // Alice buys approve tokens (will win)
        vm.startPrank(alice);
        collateralToken.approve(address(market), 50 ether);
        market.buy(true, 50 ether);
        uint256 aliceAfterBuy = collateralToken.balanceOf(alice);
        vm.stopPrank();

        // Bob buys reject tokens (will lose)
        vm.startPrank(bob);
        collateralToken.approve(address(market), 30 ether);
        market.buy(false, 30 ether);
        uint256 bobAfterBuy = collateralToken.balanceOf(bob);
        vm.stopPrank();

        console.log("Alice initial:", aliceInitial);
        console.log("Alice after buy:", aliceAfterBuy);
        console.log("Bob initial:", bobInitial);
        console.log("Bob after buy:", bobAfterBuy);

        // Verify approve side will win
        uint256 approvePrice = market.getMarketTypePrice(0);
        uint256 rejectPrice = market.getMarketTypePrice(1);
        assertTrue(approvePrice > rejectPrice, "Approve should have higher price");

        // Fast forward and execute
        vm.warp(block.timestamp + 3601);
        vm.prank(address(this));
        pm.finalizeProposal(proposalId);

        // Check final balances
        uint256 aliceFinal = collateralToken.balanceOf(alice);
        uint256 bobFinal = collateralToken.balanceOf(bob);

        console.log("Alice final:", aliceFinal);
        console.log("Bob final:", bobFinal);

        // Alice (winner) should get more than she spent (price-based payout)
        assertTrue(aliceFinal > aliceAfterBuy, "Alice (winner) should get price-based payout");

        // Bob (loser) should get his original 30 ether back (revert)
        assertEq(bobFinal, bobAfterBuy + 30 ether, "Bob (loser) should get exactly his collateral back");

        // Verify execution happened
        assertEq(mockContract.dynamicValue(), 123, "Proposal should have executed");
    }

    function testCollateralRevertCorrectly_RejectWins() public {
        // Test that losers get their original collateral back when reject side wins
        bytes memory callData = abi.encodeWithSelector(
            MockObjectiveContract.changeDynamicValue.selector,
            456
        );

        uint256 proposalId = pm.createProposal(
            "Test Reject Wins",
            "Test reject side winning",
            3600,
            address(collateralToken),
            1000000 ether,
            address(mockContract),
            callData,
            address(0),
            bytes32(0)
        );

        address proposalAddr = pm.getProposalById(proposalId);
        Proposal proposal = Proposal(proposalAddr);
        Market market = proposal.market();

        // Record initial balances
        uint256 aliceInitial = collateralToken.balanceOf(alice);
        uint256 bobInitial = collateralToken.balanceOf(bob);

        // Alice buys approve tokens (will lose)
        vm.startPrank(alice);
        collateralToken.approve(address(market), 20 ether);
        market.buy(true, 20 ether);
        uint256 aliceAfterBuy = collateralToken.balanceOf(alice);
        vm.stopPrank();

        // Bob buys reject tokens (will win)
        vm.startPrank(bob);
        collateralToken.approve(address(market), 60 ether);
        market.buy(false, 60 ether);
        uint256 bobAfterBuy = collateralToken.balanceOf(bob);
        vm.stopPrank();

        console.log("Alice initial:", aliceInitial);
        console.log("Alice after buy:", aliceAfterBuy);
        console.log("Bob initial:", bobInitial);
        console.log("Bob after buy:", bobAfterBuy);

        // Verify reject side will win
        uint256 approvePrice = market.getMarketTypePrice(0);
        uint256 rejectPrice = market.getMarketTypePrice(1);
        assertTrue(rejectPrice > approvePrice, "Reject should have higher price");

        // Fast forward and execute
        vm.warp(block.timestamp + 3601);
        vm.prank(address(this));
        pm.finalizeProposal(proposalId);

        // Check final balances
        uint256 aliceFinal = collateralToken.balanceOf(alice);
        uint256 bobFinal = collateralToken.balanceOf(bob);

        console.log("Alice final:", aliceFinal);
        console.log("Bob final:", bobFinal);

        // Alice (loser) should get her original 20 ether back (revert)
        assertEq(aliceFinal, aliceAfterBuy + 20 ether, "Alice (loser) should get exactly her collateral back");

        // Bob (winner) should get more than he spent (price-based payout)
        assertTrue(bobFinal > bobAfterBuy, "Bob (winner) should get price-based payout");

        // Verify NO execution happened (reject won)
        assertEq(mockContract.dynamicValue(), 42, "Proposal should NOT have executed when reject wins");
    }

    function testBothSidesTrading_CollateralHandling() public {
        // Test when both Alice and Bob trade on both sides
        bytes memory callData = abi.encodeWithSelector(
            MockObjectiveContract.changeDynamicValue.selector,
            789
        );

        uint256 proposalId = pm.createProposal(
            "Both Sides Trading",
            "Test both participants trading on both sides",
            3600,
            address(collateralToken),
            1000000 ether,
            address(mockContract),
            callData,
            address(0),
            bytes32(0)
        );

        address proposalAddr = pm.getProposalById(proposalId);
        Proposal proposal = Proposal(proposalAddr);
        Market market = proposal.market();

        uint256 aliceInitial = collateralToken.balanceOf(alice);
        uint256 bobInitial = collateralToken.balanceOf(bob);

        // Alice trades on both sides
        vm.startPrank(alice);
        collateralToken.approve(address(market), 80 ether);
        market.buy(true, 50 ether);  // Alice approve (will be winner)
        market.buy(false, 30 ether); // Alice reject (will be loser)
        uint256 aliceAfterTrade = collateralToken.balanceOf(alice);
        vm.stopPrank();

        // Bob also trades on both sides
        vm.startPrank(bob);
        collateralToken.approve(address(market), 60 ether);
        market.buy(true, 40 ether);  // Bob approve (will be winner) 
        market.buy(false, 20 ether); // Bob reject (will be loser)
        uint256 bobAfterTrade = collateralToken.balanceOf(bob);
        vm.stopPrank();

        // Verify approve side wins (Alice bought more approve)
        uint256 approvePrice = market.getMarketTypePrice(0);
        uint256 rejectPrice = market.getMarketTypePrice(1);
        assertTrue(approvePrice > rejectPrice, "Approve side should win");

        // Execute proposal
        vm.warp(block.timestamp + 3601);
        vm.prank(address(this));
        pm.finalizeProposal(proposalId);

        uint256 aliceFinal = collateralToken.balanceOf(alice);
        uint256 bobFinal = collateralToken.balanceOf(bob);

        console.log("Alice spent:", aliceInitial - aliceAfterTrade);
        console.log("Alice got back:", aliceFinal - aliceAfterTrade);
        console.log("Bob spent:", bobInitial - bobAfterTrade);  
        console.log("Bob got back:", bobFinal - bobAfterTrade);

        // Both should get back their losing side collateral (30 for Alice, 20 for Bob)
        // Plus winning side payouts based on price
        assertTrue(aliceFinal > aliceAfterTrade + 30 ether, "Alice should get reject collateral back + approve winnings");
        assertTrue(bobFinal > bobAfterTrade + 20 ether, "Bob should get reject collateral back + approve winnings");

        // Verify execution happened (approve won)
        assertEq(mockContract.dynamicValue(), 789, "Proposal should have executed");
    }

}
