// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";

import {ProposalManager} from "../src/ProposalManager.sol";
import {Proposal} from "../src/Proposal.sol";
import {Market} from "../src/Market.sol";
import {MarketToken} from "../src/MarketToken.sol";
import {TestERC20} from "./mocks/TestERC20.sol";
import {MockObjectiveContract} from "./mocks/MockObjectiveContract.sol";


abstract contract ProposalManagerTestBase is Test {
    address internal admin;
    address internal deployer;
    address internal alice;
    address internal bob;

    // Implementations (logic contracts)
    Proposal internal proposalImpl;
    Market internal marketImpl;
    MarketToken internal marketTokenImpl;

    ProposalManager internal pm;

    // collateralToken token for markets
    TestERC20 internal collateralToken;
    
    // Mock contract for testing proposal execution
    MockObjectiveContract internal mockContract;

    function setUp() public virtual {
        admin = makeAddr("admin");
        deployer = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        proposalImpl = new Proposal();
        marketImpl = new Market();
        marketTokenImpl = new MarketToken();

        pm = new ProposalManager(address(proposalImpl), address(marketImpl), address(marketTokenImpl));

        collateralToken = new TestERC20();
        collateralToken.transfer(admin, 1000 ether);
        collateralToken.transfer(alice, 1000 ether);
        collateralToken.transfer(bob,   1000 ether);

        mockContract = new MockObjectiveContract();
    }
}
