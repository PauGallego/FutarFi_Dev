// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./ProposalManagerTestBase.t.sol";
import {Proposal} from "../src/Proposal.sol";
import {Market} from "../src/Market.sol";
import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

contract ProposalManagerTest is ProposalManagerTestBase {
   

     function setUp() public override{
        super.setUp();

    }

    function testCreateProposal() public {
        vm.startPrank(admin, admin);

        // Create a proposal
        uint256 proposalId = pm.createProposal(
            "Test Proposal",
            "This is a test proposal",
            7 days,
            address(collateralToken),
            10000 ether,
            address(0), // target contract
            ""         // execution data
        );

        // Verify the proposal was created
        address proposalAddress = pm.getProposalById(proposalId);
        require(proposalAddress != address(0), "Proposal not created");
        
        vm.stopPrank();
    }

    
}
