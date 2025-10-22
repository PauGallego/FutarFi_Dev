// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/core/DutchAuction.sol";
import "../src/core/Treasury.sol";
import "../src/tokens/MarketToken.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Proposal} from "../src/core/Proposal.sol";

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

    function setUp() public {
        pyusd = new MockERC20();
        treasury = new Treasury(address(pyusd));

        // Deploy tokens with owner = this test contract so we can set minter later
        yesToken = new MarketToken("YES", "YES", address(this), address(1), CAP);
        noToken = new MarketToken("NO", "NO", address(this), address(1), CAP);

        proposal = new Proposal(
            1,
            admin,
            "Test Proposal",
            "Description",
            100,            // auctionDuration
            200,            // liveDuration
            address(1),     // subjectToken
            address(pyusd),
            500_000e18,     // minToOpen
            CAP,            // maxCap
            address(0),     // target
            "",             // data
            address(0),     // pythAddr
            bytes32(0)     // pythId
        );

        vm.startPrank(address(proposal));
        // Create auctions: duration 100s, priceStart = 1_000_000 (6 decimals), minToOpen = 500_000e18, admin = admin
        yesAuction = new DutchAuction(address(pyusd), address(yesToken), address(treasury), 100, 1_000_000, 500_000e18, admin);
        noAuction  = new DutchAuction(address(pyusd), address(noToken),  address(treasury), 100, 1_000_000, 500_000e18, admin);
        vm.stopPrank();

        // Set minters to the auction addresses
        yesToken.setMinter(address(yesAuction));
        noToken.setMinter(address(noAuction));

        // Set auctions in treasury (onlyOwner = this contract)
        treasury.setAuctions(address(yesAuction), address(noAuction));

        // Distribute pyusd to buyer and approve treasury
        pyusd.transfer(buyer, 1_000e18);
        vm.prank(buyer);
        pyusd.approve(address(treasury), type(uint256).max);
    }

    function test_BuyLiquidity_mintsAndFundsTreasury() public {
        // price at start should be PRICE_START
        uint256 price = yesAuction.priceNow();
        assertEq(price, 1_000_000);

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
        // warp halfway through auction duration
        vm.warp(block.timestamp + 50);
        uint256 midPrice = yesAuction.priceNow();
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

        console.log("Buying tokens: ", tokensToBuy);
        console.log("Pay amount: ", payAmount);

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