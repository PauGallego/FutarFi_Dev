// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {ProposalManager} from "../src/ProposalManager.sol";
import {Proposal} from "../src/Proposal.sol";
import {Market} from "../src/Market.sol";
import {MarketToken} from "../src/MarketToken.sol";

contract DeployScript is Script {
    
    // Deployed contract addresses will be stored here
    ProposalManager public proposalManager;
    Proposal public proposalImpl;
    Market public marketImpl;
    MarketToken public marketTokenImpl;

    function run() external {
        vm.startBroadcast();

        proposalImpl = new Proposal();

        marketImpl = new Market();

        marketTokenImpl = new MarketToken();

        proposalManager = new ProposalManager(
            address(proposalImpl),
            address(marketImpl), 
            address(marketTokenImpl)
        );

        console.log("Verifying deployment");
        require(proposalManager.proposalImpl() == address(proposalImpl), "Proposal impl not set correctly");
        require(proposalManager.marketImpl() == address(marketImpl), "Market impl not set correctly");
        require(proposalManager.marketTokenImpl() == address(marketTokenImpl), "MarketToken impl not set correctly");
        require(proposalManager.owner() == msg.sender, "Owner not set correctly");
        
        console.log("All implementations verified successfully");

        console.log("\n=== Deployment Summary ===");
        console.log("ProposalManager:", address(proposalManager));
        console.log("Proposal Implementation:", address(proposalImpl));
        console.log("Market Implementation:", address(marketImpl));
        console.log("MarketToken Implementation:", address(marketTokenImpl));
        console.log("Owner:", proposalManager.owner());
        console.log("Proposal Count:", proposalManager.proposalCount());

        vm.stopBroadcast();
    }

    // Helper function to get deployment addresses
    function getDeployedAddresses() external view returns (
        address _proposalManager,
        address _proposalImpl,
        address _marketImpl,
        address _marketTokenImpl
    ) {
        return (
            address(proposalManager),
            address(proposalImpl),
            address(marketImpl),
            address(marketTokenImpl)
        );
    }
}
