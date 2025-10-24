// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/core/ProposalManager.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";


/// @notice Simple mock ERC20 used as PYUSD collateral in tests
contract MockERC20 is ERC20 {
    constructor() ERC20("MockUSD", "MUSD") {
        _mint(msg.sender, 1_000_000e18);
    }
}

contract ProposalManagerBasicTest is Test {
    ProposalManager public pm;
    MockERC20 public pyusd;
    Proposal public proposalImpl;

    address public bob = makeAddr("bob");
    address public alice = makeAddr("alice");
    address public attestor = makeAddr("attestor");

    address constant PYTH_CONTRACT = 0x4305FB66699C3B2702D4d05CF36551390A4c69C6;
    bytes32 constant PYTH_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    function setUp() public {
        pyusd = new MockERC20();
        proposalImpl = new Proposal();
        vm.label(address(pyusd), "pyUSD");
        pm = new ProposalManager(address(pyusd), address(proposalImpl), attestor);
        vm.label(address(pm), "ProposalManager");
    }

    /// @notice Creates a proposal and asserts it is indexed and discoverable
    function test_CreateProposal_Indexes() public {
        vm.prank(bob);
        uint256 id = pm.createProposal(
            "Title",
            "Description",
            100,            // auctionDuration
            200,            // liveDuration
            "Subject Token",     // subjectToken
            1,              // minToOpen
            1000e18,        // maxCap
            address(0),     // target
            "",            // data
            PYTH_CONTRACT,     // pythAddr
            PYTH_ID      // pythId
        );

        assertEq(id, 1);
        assertEq(pm.nextId(), 1);

        address proposalAddrBob = pm.getProposalById(1);
        assertTrue(proposalAddrBob != address(0));

        address[] memory all = pm.getAllProposals();
        assertEq(all.length, 1);

        address[] memory byBob = pm.getProposalsByAdmin(bob);
        assertEq(byBob.length, 1);
        assertEq(byBob[0], proposalAddrBob);

        vm.prank(alice);
        uint256 id2 = pm.createProposal(
            "Title",
            "Description",
            100,            
            200,            
            "Subject Token",     
            1,              
            1000e18,        
            address(0),     
            "",            
            PYTH_CONTRACT,    
            PYTH_ID     
        );

        assertEq(id2, 2);
        assertEq(pm.nextId(), 2);

        address proposalAddrAlice = pm.getProposalById(2);
        assertTrue(proposalAddrAlice != address(0));

        all = pm.getAllProposals();
        assertEq(all.length, 2);

        address[] memory byAlice = pm.getProposalsByAdmin(alice);
        assertEq(byAlice.length, 1);
        assertEq(byAlice[0], proposalAddrAlice);
    }
}
