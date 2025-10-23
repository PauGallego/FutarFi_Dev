// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/core/DutchAuction.sol";
import "../src/core/Treasury.sol";
import "../src/tokens/MarketToken.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Proposal} from "../src/core/Proposal.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("MockUSD", "MUSD") {
        _mint(msg.sender, 1_000_000e18);
    }
}


contract DutchAuctionTest is Test {
    Proposal proposal;
    MockERC20 pyusd;
    Treasury treasury;
    MarketToken yesToken;
    MarketToken noToken;
    DutchAuction yesAuction;
    DutchAuction noAuction;

    address buyer = makeAddr("buyer");
    address admin = makeAddr("admin");

    uint256 constant CAP = 1_000_000e18;

    address constant PYTH_CONTRACT = 0x4305FB66699C3B2702D4d05CF36551390A4c69C6;
    bytes32 constant PYTH_ID = 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace;

    function setUp() public {
        pyusd = new MockERC20();
        treasury = new Treasury(address(pyusd));

        // Deploy tokens with owner = this test contract so we can set minter later
        yesToken = new MarketToken("YES", "YES", address(this), address(1), CAP);
        noToken = new MarketToken("NO", "NO", address(this), address(1), CAP);
        proposal = new Proposal();
        proposal.initialize(
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
            PYTH_CONTRACT,     // pythAddr
            PYTH_ID        // pythId
        );

        vm.startPrank(address(proposal));
        // Create auctions: duration 100s, priceStart = 1_000_000 (6 decimals), minToOpen = 500_000e18, admin = admin
        yesAuction = DutchAuction(proposal.yesAuction());
        noAuction  = DutchAuction(proposal.noAuction());
        vm.stopPrank();

        // Set minters to the auction addresses
        yesToken.setMinter(address(yesAuction));
        noToken.setMinter(address(noAuction));

        // Set auctions in treasury (onlyOwner = this contract)
        treasury.setAuctions(address(yesAuction), address(noAuction));

        // Distribute pyusd to buyer and approve treasury
        pyusd.transfer(buyer, 1_000_000e18);
        vm.prank(buyer);
        pyusd.approve(address(treasury), type(uint256).max);
    }

    function test_BuyLiquidity_mintsAndFundsTreasury() public {
        // price at start should be PRICE_START
        uint256 price = yesAuction.priceNow();

        uint256 payAmount = 1_000_000; // 1_000_000 units (6 decimals) -> should give 1e18 tokens

        console.log("yes token totalSupply before: ", yesToken.totalSupply());
        // buyer buys
        vm.prank(buyer);
        yesAuction.buyLiquidity(payAmount);

        console.log("yes token totalSupply after: ", yesToken.totalSupply());

        // tokens minted to buyer: tokensOut = (payAmount * 1e18) / price
        uint256 expectedTokens = (payAmount * 1e18) / price;
        assertEq(yesToken.balanceOf(buyer), expectedTokens);

        // Treasury recorded balances and potYes
        assertEq(treasury.balances(buyer), payAmount);
        assertEq(treasury.potYes(), payAmount);
    }

    function test_PriceNow_decreasesOverTime() public {
        uint256 startPrice = yesAuction.priceNow();
        console.log("Starting price: ", startPrice);
        // warp halfway through auction duration
        vm.warp(block.timestamp + 50);
        uint256 midPrice = yesAuction.priceNow();
        console.log("Midway price: ", midPrice);
        assertTrue(midPrice < startPrice, "price should decrease over time");

        // warp to end
        vm.warp(block.timestamp + 60);
        uint256 endPrice = yesAuction.priceNow();
        assertEq(endPrice, 0);
    }


    // test buying all tokens up to cap and verify that auction finalizes
    function test_BuyLiquidity_upToCapAndFinalize() public {
        uint256 price = yesAuction.priceNow();
        uint256 tokensToBuy = CAP - yesToken.totalSupply(); // buy up to cap
        uint256 payAmount = (tokensToBuy * price) / 1e18;


        // buyer buys
        vm.prank(buyer);
        yesAuction.buyLiquidity(payAmount);
        // auction should be finalized
        assertEq(yesToken.totalSupply(), CAP);
        assertTrue(yesAuction.isFinalized(), "Auction should be finalized");
        // buyer should have all tokens
        assertEq(yesToken.balanceOf(buyer), tokensToBuy);
    }


  
}