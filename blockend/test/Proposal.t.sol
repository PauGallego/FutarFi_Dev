// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/core/Proposal.sol";
import "../src/core/DutchAuction.sol";
import "../src/interfaces/IProposal.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ProposalManager} from "../src/core/ProposalManager.sol";
import {TargetContractMock} from "./mocks/TargetContractMock.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @notice Simple mock ERC20 used as PYUSD collateral in tests
contract MockERC20 is ERC20 {
    constructor() ERC20("MockUSD", "MUSD") {
        _mint(msg.sender, 1_000_000e18);
    }
}



contract ProposalBasicTest is Test {
    ProposalManager public pm;
    MockERC20 public pyusd;
    TargetContractMock public target;
    Proposal public proposal;
    address public attestor;
    address public alice;
    address public buyer;

    address constant PYTH_CONTRACT = 0x4305FB66699C3B2702D4d05CF36551390A4c69C6;
    bytes32 constant PYTH_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    function setUp() public {
        pyusd = new MockERC20();
        target = new TargetContractMock();
        attestor = makeAddr("attestor");
        proposal = new Proposal();
        pm = new ProposalManager(address(pyusd), address(proposal), attestor);
        alice = makeAddr("alice");
        buyer = makeAddr("buyer");
    }

    // test the refund token when auction is canceled
    function test_Refund_afterAuctionCancelled() public {

        pm.createProposal(
            "T",
            "D",
            10,            // auctionDuration
            100,           // liveDuration
            "Subject Token",     // subjectToken
            999e18,              // minToOpen
            1000e18,        // maxCap
            address(0),     // target
            "",            // data
            PYTH_CONTRACT,     // pythAddr
            PYTH_ID      // pythId
        );
        proposal = Proposal(pm.getProposalById(1));

        DutchAuction yes = proposal.yesAuction();
        MarketToken yesToken = proposal.yesToken();
        Treasury treasury = proposal.treasury();

        // Give buyer some pyUSD and approve treasury to pull pyUSD when buying
        pyusd.transfer(buyer, 1_000e18);
        vm.prank(buyer);
        pyusd.approve(address(treasury), type(uint256).max);

        // Buyer buys a small amount (half a token) so it does NOT meet minToOpen
        uint256 payAmount = 500_000; // yields 0.5e18 tokens at price 1_000_000
        vm.prank(buyer);
        yes.buyLiquidity(payAmount);

        uint256 userTokens = yesToken.balanceOf(buyer);
        assertTrue(userTokens > 0 && userTokens < 1e18, "buyer has amount of tokens");

        // Warp to after auction end and finalize as admin -> this will mark the auction canceled
        uint256 end = yes.END_TIME();
        vm.warp(end + 1);

        // Now tell the Proposal to settle auctions (should detect canceled auction and enable refunds)
        // proposal.settleAuctions();
        vm.prank(attestor);
        yes.finalize();

        // Proposal should be Cancelled
        assertEq(uint8(proposal.state()), uint8(IProposal.State.Cancelled), "Proposal not cancelled");

        // Tokens should be finalized as loser (paused)
        assertTrue(yesToken.paused(), "yes token paused");
        assertTrue(treasury.refundsEnabled(), "refunds enabled in treasury");

        // Buyer approves Treasury to pull their outcome tokens for refund
        vm.prank(buyer);
        yesToken.approve(address(treasury), userTokens);

        uint256 beforePy = pyusd.balanceOf(buyer);
        uint256 beforeYesTokens = yesToken.balanceOf(address(treasury));
        uint256 beforePyTokens = pyusd.balanceOf(address(treasury));

        // Buyer calls auction.refundTokens() which will cause Treasury to refund PYUSD
        vm.prank(buyer);
        yes.refundTokens();

        // After refund, buyer should have no outcome tokens and should have received pyUSD refund
        assertEq(yesToken.balanceOf(buyer), 0, "buyer has zero yes tokens after refund");
        assertTrue(pyusd.balanceOf(buyer) > beforePy, "buyer received pyUSD refund");
        assertEq(yesToken.balanceOf(address(treasury)), beforeYesTokens + userTokens, "treasury received yes tokens");
        assertLt(pyusd.balanceOf(address(treasury)), beforePyTokens, "treasury pyusd balance increased");
    }


    function test_ExecuteCalldataToTarget() public {

        // calldata to toggle target flag to true
        bytes memory data = abi.encodeWithSelector(TargetContractMock.setTrue.selector);

        // Create a proposal with tiny caps so both auctions can hit cap quickly
        pm.createProposal(
            "Title",
            "Description",
            10,              // auctionDuration
            20,              // liveDuration
            "Subject Token",
            2,            // minToOpen (1 token)
            3_000_000,            // maxCap (1 token)
            address(target), // target
            data,            // data
            PYTH_CONTRACT,   // pythAddr (mock)
            PYTH_ID    // pythId (unused by mock)
        );
        proposal = Proposal(pm.getProposalById(1));

        DutchAuction yes = proposal.yesAuction();
        DutchAuction no = proposal.noAuction();
        MarketToken yesToken = proposal.yesToken();
        MarketToken noToken = proposal.noToken();
        Treasury treasury = proposal.treasury();

        // Fund two buyers for the auctions and approve Treasury
        address buyerYes = makeAddr("buyerYes");
        address buyerNo = makeAddr("buyerNo");
        pyusd.transfer(buyerYes, 2_100_000); // enough for auction + later trades
        pyusd.transfer(buyerNo, 2_100_000);
        vm.prank(buyerYes);
        pyusd.approve(address(treasury), type(uint256).max);
        vm.prank(buyerNo);
        pyusd.approve(address(treasury), type(uint256).max);

        vm.prank(buyerYes);
        yes.buyLiquidity(1); 
        vm.prank(buyerNo);
        no.buyLiquidity(1);  

        uint256 endTime = yes.END_TIME();
        vm.warp(endTime + 1);

        vm.prank(attestor);
        yes.finalize();
        vm.prank(attestor);
        no.finalize();

        // After both auctions, proposal live times are set
        assertGt(proposal.liveStart(), 0, "liveStart not set");
        assertGt(proposal.liveEnd(), 0, "liveEnd not set");


        // Prepare secondary market batch to set TWAPs and trigger resolve
        address takerYes = makeAddr("takerYes");
        address takerNo = makeAddr("takerNo");
        pyusd.transfer(takerYes, 10_000);
        pyusd.transfer(takerNo, 10_000);

        // Approvals for Proposal to move funds in applyBatch
        vm.prank(buyerYes);
        yesToken.approve(address(proposal), 2e17); // sell 0.2 YES
        vm.prank(takerYes);
        pyusd.approve(address(proposal), 10_000);
        vm.prank(buyerNo);
        noToken.approve(address(proposal), 2e17);  // sell 0.2 NO
        vm.prank(takerNo);
        pyusd.approve(address(proposal), 10_000);

        // Force Proposal owner to be attestor so _executeTargetCalldata (onlyOwner) passes
        vm.store(address(proposal), bytes32(uint256(0)), bytes32(uint256(uint160(attestor))));

        // Move to after live end and set state to Live (enum: 0=Auction,1=Live,2=Resolved,3=Cancelled)
        uint256 le = proposal.liveEnd();
        vm.warp(le + 1);
        // Ownable._owner is slot 0; Proposal.state is the next variable at slot 1
        vm.store(address(proposal), bytes32(uint256(1)), bytes32(uint256(1)));

        // Build trades with higher TWAP for YES so YES wins
        IProposal.Trade[] memory ops = new IProposal.Trade[](2);
        ops[0] = IProposal.Trade({
            seller: buyerYes,
            buyer: takerYes,
            outcomeToken: address(yesToken),
            tokenAmount: 2e17,
            pyUsdAmount: 5_000,
            twapPrice: 200
        });
        ops[1] = IProposal.Trade({
            seller: buyerNo,
            buyer: takerNo,
            outcomeToken: address(noToken),
            tokenAmount: 2e17,
            pyUsdAmount: 4_000,
            twapPrice: 100
        });

        // Apply the batch as attestor; should resolve and execute target calldata
        vm.prank(attestor);
        proposal.applyBatch(ops);

        // Expect proposal resolved and target flag toggled to false
        assertEq(uint8(proposal.state()), uint8(IProposal.State.Resolved), "proposal not resolved");
        assertEq(target.flag(), false, "target flag should be false after execution");

        // NO should be loser and paused
        assertTrue(noToken.paused(), "NO token should be paused as loser");
    }
}
