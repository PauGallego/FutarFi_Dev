// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/core/DutchAuction.sol";
import "../src/core/Treasury.sol";
import "../src/tokens/MarketToken.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Proposal} from "../src/core/Proposal.sol";
import {ProposalManager} from "../src/core/ProposalManager.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("MockUSD", "MUSD") {
        _mint(msg.sender, 1_000_000_000_000e18);
    }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract DutchAuctionTest is Test {
    ProposalManager public pm;
    Proposal proposal;
    MockERC20 pyusd;
    Treasury treasury;
    MarketToken yesToken;
    MarketToken noToken;
    DutchAuction yesAuction;
    DutchAuction noAuction;

    address buyer = makeAddr("buyer");
    address attestor = makeAddr("attestor");


    address constant PYTH_CONTRACT = 0x4305FB66699C3B2702D4d05CF36551390A4c69C6;
    bytes32 constant PYTH_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    uint256 constant CAP = 500_000e18;

    function setUp() public {
        proposal = new Proposal();
        pyusd = new MockERC20();
        pm = new ProposalManager(address(pyusd), address(proposal), attestor);

        pm.createProposal(
            "Title",
            "Description",
            100000,            // auctionDuration
            200000,            // liveDuration
            "Subject Token",     // subjectToken
            999e18,              // minToOpen
            CAP,        // maxCap
            address(0),     // target
            "",            // data
            PYTH_CONTRACT,     // pythAddr
            PYTH_ID      // pythId
        );
        proposal = Proposal(pm.getProposalById(1));

        // vm.startPrank(address(proposal));
        // Create auctions: duration 100s, priceStart = 1_000_000 (6 decimals), minToOpen = 500_000e18, admin = admin
        yesAuction = DutchAuction(proposal.yesAuction());
        noAuction  = DutchAuction(proposal.noAuction());

        yesToken = proposal.yesToken();
        noToken  = proposal.noToken();

        treasury = Treasury(proposal.treasury());

        // vm.stopPrank();

        pyusd.transfer(buyer, 1_000_000_000_000e18);
        
    }

    function test_BuyLiquidity_mintsAndFundsTreasury() public {
        uint256 price = yesAuction.priceNow();

        uint256 payAmount = 1_000_000;
        
        vm.startPrank(buyer);
        pyusd.approve(address(treasury), type(uint256).max);
        yesAuction.buyLiquidity(payAmount);
        vm.stopPrank();

        uint256 expectedTokens = (payAmount * 1e6) / price;
        assertEq(yesToken.balanceOf(buyer), expectedTokens, "buyer token balance");

        assertEq(treasury.balances(buyer), payAmount, "treasury recorded balance");
        assertEq(treasury.potYes(), payAmount, "treasury potYes updated");
    }

    function test_PriceNow_decreasesOverTime() public {
        uint256 startPrice = yesAuction.priceNow();
        // warp halfway through auction duration
        vm.warp(block.timestamp + 50);
        uint256 midPrice = yesAuction.priceNow();
        assertTrue(midPrice < startPrice, "price should decrease over time");

        // warp to end
        uint256 endTime = yesAuction.END_TIME();
        vm.warp(endTime + 1);
        uint256 endPrice = yesAuction.priceNow();
        assertEq(endPrice, 0);
    }


    // test buying all tokens up to cap and verify that auction finalizes
    function test_BuyLiquidity_upToCapAndFinalize() public {
        uint256 price = yesAuction.priceNow();

        // buy over the cap, must buy only up to cap and return the rest
        uint256 tokensToBuy = (CAP - yesToken.totalSupply() ) + 1; // buy up to cap
        uint256 payAmount = (tokensToBuy * price) / 1e6;

        uint256 buyerInitialPYUSD = pyusd.balanceOf(buyer);
        // buyer buys
        vm.startPrank(buyer);
        pyusd.approve(address(treasury), type(uint256).max);
        yesAuction.buyLiquidity(payAmount);
        vm.stopPrank();
        uint256 buyerFinalPYUSD = pyusd.balanceOf(buyer);
        // check PYUSD spent
        assertApproxEqAbs(buyerInitialPYUSD - buyerFinalPYUSD, payAmount, 10000, "PYUSD spent should equal payAmount");

        // check tokens received
        uint256 expectedTokens = (payAmount * 1e6) / price;
        assertEq(yesToken.balanceOf(buyer), expectedTokens, "Buyer should receive expected tokens");

        // auction should be finalized
        assertEq(yesToken.totalSupply(), CAP, "Yes token total supply should equal cap");
        assertTrue(yesAuction.isFinalized(), "Auction should be finalized");
        assertApproxEqAbs(yesToken.balanceOf(buyer), tokensToBuy, 1, "Buyer should have all tokens up to cap");
    }


  
}