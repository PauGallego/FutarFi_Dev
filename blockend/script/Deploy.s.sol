// // SPDX-License-Identifier: MIT
// pragma solidity ^0.8.24;

// import "forge-std/Script.sol";

// // === Your contracts ===
// // import {MarketToken} from "../src/MarketToken.sol";
// // import {Proposal} from "../src/Proposal.sol";
// import {ProposalManager} from "../src/ProposalManager.sol";
// // import {Market} from "../src/Market.sol";

// contract Deploy is Script {
//     struct Deployed {
//         ProposalManager manager;
//     }

//     function run() public returns (Deployed memory d) {
//         vm.startBroadcast();

//         d.manager = new ProposalManager();


//         vm.stopBroadcast();

//         // Logs to console
//         console2.log("=== Deploy summary ===");
//         console2.log("ChainId         :", block.chainid);
//         console2.log("ProposalManager :", address(d.manager));

//         // Persist addresses to JSON for your frontend (chain-specific file)
//         // e.g. frontend/src/lib/addresses.<chainId>.json
//         string memory root = vm.projectRoot();
//         string memory outPath = string.concat(
//             root,
//             "/frontend/src/lib/addresses.",
//             vm.toString(block.chainid),
//             ".json"
//         );

//         string memory key = "addrs";
//         vm.serializeAddress(key, "MarketToken", address(d.token));
//         vm.serializeAddress(key, "ProposalManager", address(d.manager));
//         vm.serializeAddress(key, "Market", address(d.market));
//         vm.serializeAddress(key, "Proposal", address(d.proposal));

//         // Add chainId as a field (optional, useful for debugging)
//         string memory json = vm.serializeString(key, "chainId", vm.toString(block.chainid));
//         vm.writeJson(json, outPath);
//         console2.log("Addresses JSON  :", outPath);
//     }
// }
