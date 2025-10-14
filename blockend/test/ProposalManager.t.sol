// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;


// import {ERC20} from "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {ProposalManager} from "../src/ProposalManager.sol";
import {MarketToken} from "../src/MarketToken.sol";
import {MockToken} from "./mocks/TestERC20.sol";
import {ProposalManagerTestBase} from "./ProposalManagerTestBase.t.sol";

contract ProposalManagerTest is ProposalManagerTestBase{


    function setUp() public override{
        super.setUp();

    }

    function testCreateProposal() public {
        vm.startPrank(admin, admin);

        // Create a proposal
        uint256 proposalId = proposalManager.createProposal(
            "Test Proposal",
            "This is a test proposal",
            7 days,
            address(collateralToken),
            "ApproveToken",
            "APP",
            "RejectToken",
            "REJ",
            10000 ether,
            address(0),
            ""
        );


        // Verify the proposal was created
        address proposalAddress = proposalManager.getProposalById(proposalId);
        require(proposalAddress != address(0), "Proposal not created");
    }


    

}

