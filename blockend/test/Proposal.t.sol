// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/core/Proposal.sol";
import "../src/core/DutchAuction.sol";
import "../src/interfaces/IProposal.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

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

    function setUp() public {
        admin = makeAddr("admin");
        pyusd = new MockERC20();
    }

    /// @notice After auctions finalize the Proposal should have live times set but remain in Auction state (new contract behavior)
    function test_Auctions_SetLiveTimes_but_stateRemainsAuction() public {
        // Deploy Proposal with auctionDuration=10, liveDuration=100, minToOpen=0 so finalize succeeds when time passes
        proposal = new Proposal(
            1,
            admin,
            "T",
            "D",
            10,            // auctionDuration
            100,           // liveDuration
            address(1),    // subjectToken
            address(pyusd),
            0,             // minToOpen (allow finalize without tokens)
            1000e18,       // maxCap
            address(0),    // target
            "",           // data
            address(0),    // pythAddr
            bytes32(0)     // pythId
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
}
