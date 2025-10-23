//SPDX-License-Identifier: MIT
 pragma solidity ^0.8.30;

 import "forge-std/Script.sol";
 import "forge-std/console.sol";
 import {ProposalManager} from "../src/core/ProposalManager.sol";
 import {PyUSD} from "../src/tokens/PyUSD.sol";
 import {Proposal} from "../src/core/Proposal.sol";

 contract DeployScript is Script {
    PyUSD public pyusd;
    ProposalManager public proposalManager;
    Proposal public proposal;

    function run() external {
        vm.startBroadcast();

        // Deploy PYUSD (6 decimals). Mint initial supply to deployer for testing
        uint256 initialSupply = 1_000_000 * 10 ** 6; // 1,000,000 PYUSD
        pyusd = new PyUSD(msg.sender, initialSupply);

        proposal = new Proposal();
        // Deploy ProposalManager with PYUSD address
        proposalManager = new ProposalManager(address(pyusd), address(proposal));

        // Basic checks
        require(proposalManager.PYUSD() == address(pyusd), "PM: wrong PYUSD");
        require(proposalManager.owner() == msg.sender, "PM: wrong owner");

        console.log("\n=== Deployment Summary ===");
        console.log("PYUSD:", address(pyusd));
        console.log("ProposalManager:", address(proposalManager));
        console.log("Owner:", proposalManager.owner());
        console.log("nextId:", proposalManager.nextId());

        vm.stopBroadcast();
    }
}
