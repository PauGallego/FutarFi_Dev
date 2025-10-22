// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IProposal} from "../interfaces/IProposal.sol";
import {IDutchAuction} from "../interfaces/IDutchAuction.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MarketToken} from "../tokens/MarketToken.sol";
import {Treasury} from "./Treasury.sol";
import {DutchAuction} from "./DutchAuction.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Treasury} from "./Treasury.sol";
import {console} from "forge-std/console.sol";

contract Proposal is Ownable, IProposal {

    State public state;

    // core identifiers / metadata
    uint256 public id;
    address public admin;
    string  public title;
    string  public description;
    uint256 public auctionStartTime;
    uint256 public auctionEndTime;
    uint256 public liveStart;
    uint256 public liveEnd;
    uint256 public liveDuration;
    address public subjectToken;
    uint256 public minToOpen;
    uint256 public maxCap;

    // auctions / tokens / implementations
    address public pyUSD;
    DutchAuction public yesAuction;
    DutchAuction public noAuction;
    MarketToken public yesToken;
    MarketToken public noToken;

    address public target;
    bytes public data;

    Treasury public treasury;

    // Pyth Oracle
    address public pythAddr;
    bytes32 public pythId;

    event ProposalActivated(uint256 indexed id, uint256 liveStart, uint256 liveEnd);
    event ProposalResolved(uint256 indexed id, uint256 when);
    event ProposalCancelled(uint256 when);
    event ProposalLive(uint256 liveEnd);

    
    constructor(
        uint256 _id,
        address _admin, // creator of the proposal
        string memory _title,
        string memory _description,
        uint256 _auctionDuration,
        uint256 _liveDuration,
        address _subjectToken,
        address _pyUSD,
        uint256 _minToOpen,
        uint256 _maxCap,
        address _target,
        bytes memory _data,
        address _pythAddr,
        bytes32 _pythId
    ) Ownable(msg.sender) {
        // Initialize proposal metadata and auction parameters
        id = _id;
        admin = _admin;
        title = _title;
        description = _description;
        auctionStartTime  = block.timestamp;
        auctionEndTime    = block.timestamp + _auctionDuration;

        subjectToken = _subjectToken;
        pyUSD = _pyUSD;
        liveDuration = _liveDuration;
        minToOpen = _minToOpen;
        maxCap = _maxCap;
        target = _target;
        data = _data;
        pythAddr = _pythAddr;
        pythId = _pythId;

        treasury= new Treasury(pyUSD);

        // Deploy market tokens for YES and NO (temporary minter = this Proposal, updated after auctions are deployed)
        yesToken = new MarketToken(
            string.concat("FutarFi tYES #", Strings.toString(id)),
            string.concat("tYES-", Strings.toString(id)),
            address(this),
            address(this),
            maxCap
        );
        noToken = new MarketToken(
            string.concat("FutarFi tNO #", Strings.toString(id)),
            string.concat("tNO-", Strings.toString(id)),
            address(this),
            address(this),
            maxCap
        );

        // Deploy Dutch auctions for YES and NO (require token addresses in constructor)
        yesAuction = new DutchAuction(
            pyUSD,
            address(yesToken),
            address(treasury),
            _auctionDuration,
            1_000_000,   // pyth
            minToOpen,
            admin
        );

        noAuction = new DutchAuction(
            pyUSD,
            address(noToken),
            address(treasury),
            _auctionDuration,
            1_000_000,   // pyth
            minToOpen,
            admin
        );

        // Update minters on tokens to point at the newly created auctions
        yesToken.setMinter(address(yesAuction));
        noToken.setMinter(address(noAuction));

        // Set auction addresses in Treasury
        Treasury(treasury).setAuctions(address(yesAuction), address(noAuction));
        state = State.Auction;
    }

    // Settle the auctions and handles cancellation or activation
    function settleAuctions() external { // TODO:maybe onlyAuction if not called by front/back
        require(state == State.Auction, "Bad state");

        bool yesAuctionCanceled = yesAuction.isCanceled();
        bool noAuctionCanceled  = noAuction.isCanceled();

        if (yesAuctionCanceled || noAuctionCanceled) {
            // If either auction is canceled, cancel both markets and enable refunds in Treasury
            state = State.Cancelled;

            yesToken.finalizeAsLoser(address(treasury));
            noToken.finalizeAsLoser(address(treasury));

            Treasury(treasury).enableRefunds();

            auctionEndTime = block.timestamp;
            emit ProposalCancelled(block.timestamp);
            return;
        }

        bool yesAuctionValid = yesAuction.isValid();
        bool noAuctionValid  = noAuction.isValid();
        if (yesAuctionValid && noAuctionValid) {
            // If both auctions are ready, activate proposal
            auctionEndTime = block.timestamp;
            liveStart = block.timestamp;
            liveEnd = liveStart + liveDuration;
        }

    }


    // ---- Resolve only after Live ends ----
    function resolve() external override {
        require(state == State.Live, "Proposal: bad state");
        require(block.timestamp >= liveEnd, "Proposal: Live not finished");

        state = State.Resolved;
        emit ProposalResolved(id, block.timestamp);
    }


 
}