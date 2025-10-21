// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IProposal} from "../interfaces/IProposal.sol";
import {IDutchAuction} from "../interfaces/IDutchAuction.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {MarketToken} from "../tokens/MarketToken.sol";
import {Treasury} from "./Treasury.sol";
import {DutchAuction} from "./DutchAuction.sol";

contract Proposal is Ownable {

    enum State { Auction, Live, Resolved, Cancelled }
    State public state;


    // core identifiers / metadata
    uint256 public id;
    address public admin;
    string private title;
    string private description;
    uint256 public auctionStartTime;
    uint256 public auctionEndTime;
    uint256 public liveStart;
    uint256 public liveEnd;
    address public subjectToken;
    uint256 public minToOpen;
    uint256 public maxCap;

    // auctions / tokens / implementations
    address public pyUSD;
    DutchAuction public yesAuction;
    DutchAuction public noAuction;
    MarketToken public yesToken;
    MarketToken public noToken;

    address public immutable treasury;
    address public immutable escrow;
    address public attestor;

    event ProposalActivated(uint256 indexed id, uint256 liveStart, uint256 liveEnd);
    event ProposalResolved(uint256 indexed id, uint256 when);

    constructor() Ownable(msg.sender) {}
    
    function initialize(
        uint256 _id,
        address _admin,
        string calldata _title,
        string calldata _description,
        uint256 _auctionDuration,
        uint256 _liveDuration,
        address _subjectToken,
        address _pyUSD,
        uint256 _minToOpen,
        uint256 _maxCap,
        address _escrowImpl,
        address _attestor
    ) external override {
        id = _id;
        admin = _admin;
        title = _title;
        description = _description;
        auctionStartTime  = block.timestamp;
        auctionEndTime    = block.timestamp + _auctionDuration;

        subjectToken = _subjectToken;
        pyUSD = _pyUSD;
        minToOpen = _minToOpen;
        maxCap = _maxCap;

        treasury= new Treasury(pyUSD);
        escrow = _escrowImpl;

        yesToken = new MarketToken(
            string.concat("FutarFi tYES #", string(id)),
            string.concat("tYES-", string(id)),
            address(this),
            _maxCap
        );
        noToken = new MarketToken(
            string.concat("FutarFi tNO #", string(id)),
            string.concat("tNO-", string(id)),
            address(this),
            _maxCap
        );

        yesAuction = new DutchAuction(
            pyUSD,
            address(yesToken),
            treasury,
            auctionStartTime,
            auctionEndTime,
            1_000_000,   // pyth
            minToOpen
        );

        noAuction = new DutchAuction(
            pyUSD,
            address(noToken),
            treasury,
            auctionStartTime,
            auctionEndTime,
            1_000_000,   // pyth
            minToOpen
        );

        Treasury(treasury).setAuctions(address(yesAuction), address(noAuction));
        state = State.Auction;
    }


    function finalizeAuction(bool auctionType) external override {
        require(state == State.Auction, "Proposal: not Auction");

        if (auctionType)yesAuction.finalize();
        else noAuction.finalize();

        activateIfReady();
    }

    function activateIfReady() internal override {
        require(state == State.Auction, "Proposal: not Auction");

        if (yesAuction.finalized() && noAuction.finalized()) {
            activateProposal();
            state = State.Live;
            return;
        }
    
    }

    function activateProposal() internal {
        liveStart = block.timestamp;
        liveEnd = liveStart + ; // maintain live duration
        emit ProposalActivated(id, liveStart, liveEnd);
    }


    // ---- Resolve only after Live ends ----
    function resolve() external override {
        require(_state == State.Live, "Proposal: bad state");
        require(block.timestamp >= liveEnd, "Proposal: Live not finished");

        // read TWAP, decide winner, escrow.burnAll(loser), optionsAdapter.settleAndDistribute(...)
        _state = State.Resolved;
        emit ProposalResolved(id, block.timestamp);
    }


 
}