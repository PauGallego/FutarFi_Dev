// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/core/Proposal.sol";
import "../src/core/DutchAuction.sol";
import "../src/interfaces/IProposal.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

/// @notice Simple mock ERC20 used as PYUSD collateral in tests
contract MockERC20 is ERC20 {
    constructor() ERC20("MockUSD", "MUSD") {
        _mint(msg.sender, 1_000_000e18);
    }
}



contract ProposalBasicTest is Test {
    MockERC20 public pyusd;
    Proposal public proposal;
    address public admin;

    address constant PYTH_CONTRACT = 0x4305FB66699C3B2702D4d05CF36551390A4c69C6;
    bytes32 constant PYTH_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;


    function setUp() public {
        admin = makeAddr("admin");
        pyusd = new MockERC20();
        proposal = new Proposal();

        
        
    }

    /// @notice After auctions finalize the Proposal should have live times set but remain in Auction state (new contract behavior)
    function test_Auctions_SetLiveTimes_but_stateRemainsAuction() public {
        // Deploy Proposal with auctionDuration=10, liveDuration=100, minToOpen=0 so finalize succeeds when time passes
        proposal.initialize(
            1,
            admin,
            "T",
            "D",
            10,            // auctionDuration
            100,           // liveDuration
            "Subject Token",    // subjectToken
            address(pyusd),
            0,             // minToOpen (allow finalize without tokens)
            1000e18,       // maxCap
            address(0),    // target
            "",           // data
            PYTH_CONTRACT,     // pythAddr
            PYTH_ID        // pythId
        );

        // initial state should be Auction
        assertEq(uint8(proposal.state()), uint8(IProposal.State.Auction));

        // grab auctions
        DutchAuction yes = proposal.yesAuction();
        DutchAuction no = proposal.noAuction();

        // fast forward past auction end
        uint256 aEnd = proposal.auctionEndTime();
        vm.warp(aEnd + 1);

        // finalize each auction as admin (onlyAdmin)
        vm.prank(admin);
        yes.finalize();

        // after first finalize, proposal should still be Auction (needs both)
        assertEq(uint8(proposal.state()), uint8(IProposal.State.Auction));

        vm.prank(admin);
        no.finalize();

        // After both auctions finalize, auctions call settleAuctions() internally, but call explicitly to ensure state
        proposal.settleAuctions();

        // Proposal now has live times set but (per contract changes) state remains Auction
        assertTrue(proposal.liveStart() > 0, "liveStart set");
        assertEq(proposal.liveEnd(), proposal.liveStart() + proposal.liveDuration());
        assertEq(uint8(proposal.state()), uint8(IProposal.State.Auction), "state still Auction");

        // Attempting to resolve should revert because Proposal isn't Live
        vm.expectRevert(bytes("Proposal: bad state"));
        proposal.resolve();
    }


    // test the refund token when auction is canceled
    function test_Refund_afterAuctionCancelled() public {
        address buyer = makeAddr("buyer");

        proposal.initialize(
            1,
            admin,
            "T",
            "D",
            10,            // auctionDuration
            100,           // liveDuration
            "Subject Token",    // subjectToken
            address(pyusd),
            1e18,          // minToOpen (set to 1 token so 0.5e18 does not meet threshold)
            1000e18,       // maxCap
            address(0),    // target
            "",           // data
            PYTH_CONTRACT,     // pythAddr
            PYTH_ID        // pythId
        );

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
        vm.prank(admin);
        yes.finalize();

        // Now tell the Proposal to settle auctions (should detect canceled auction and enable refunds)
        proposal.settleAuctions();

        // Proposal should be Cancelled
        assertEq(uint8(proposal.state()), uint8(IProposal.State.Cancelled));

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

}
