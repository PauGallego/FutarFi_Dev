// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IProposal} from "../interfaces/IProposal.sol";
import {IDutchAuction} from "../interfaces/IDutchAuction.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Proposal is Ownable {

    uint256 public override auctionStart;
    uint256 public override auctionEnd;
    uint256 public override liveStart;
    uint256 public override liveEnd;
    uint256 public override liveDuration;

    State private _state;

    // core identifiers / metadata
    uint256 public override id;
    address public override admin;
    string private _title;
    string private _description;

    // supply / payment / infra
    address public override subjectToken;
    uint256 public override minSupplySold;
    uint256 public override maxSupply;

    // auctions / tokens / implementations
    address public override approveAuction;
    address public override rejectAuction;
    address public override tokenApprove;
    address public override tokenReject;

    address public override escrow;
    address public override twap;
    address public override settlement;
    address public override oracleAdapter;
    address public override optionsAdapter;
    address public override attestor;

    constructor() Ownable(msg.sender) {}

    // ---- Initialize ----
    function initialize(
        uint256 _id,
        address _admin,
        string calldata _title,
        string calldata _description,
        uint256 _auctionDuration,
        // payment token and limits
        address _subjectToken,
        uint256 _minSold,
        uint256 _maxSupply,
        // infrastructure (oracle, options, implementations, auctions, tokens, attestor)
        address _oracleAdapter,
        address _optionsAdapter,
        address _escrowImpl,
        address _twapImpl,
        address _settlementImpl,
        address _approveAuction,
        address _rejectAuction,
        address _tokenApprove,
        address _tokenReject,
        address _attestor,
        // new: Live phase duration
        uint256 _liveDuration

    ) external override {
        // ... (pre-checks)
        require(_auctionEnd > _auctionStart, "Proposal: bad auction window");
        require(_liveDuration > 0, "Proposal: liveDuration=0");

        // assign basic metadata
        id = _id;
        admin = _admin;
        _title = _title;
        _description = _description;

        // timings
        auctionStart  = _auctionStart;
        auctionEnd    = _auctionEnd;
        liveDuration  = _liveDuration;

        // payment / supply
        subjectToken = _subjectToken;
        minSupplySold = _minSold;
        maxSupply = _maxSupply;

        // infrastructure
        oracleAdapter = _oracleAdapter;
        optionsAdapter = _optionsAdapter;
        escrow = _escrowImpl;
        twap = _twapImpl;
        settlement = _settlementImpl;

        approveAuction = _approveAuction;
        rejectAuction = _rejectAuction;
        tokenApprove = _tokenApprove;
        tokenReject = _tokenReject;
        attestor = _attestor;

        // remaining assignments...
        _state = State.Auction;
    }


    function inAuctionWindow() public view override returns (bool) {
        if (_state != State.Auction) return false;
        uint256 t = block.timestamp;
        return (t >= auctionStart && t <= auctionEnd);
    }

    function inLiveWindow() public view override returns (bool) {
        if (_state != State.Live) return false;
        uint256 t = block.timestamp;
        return (t >= liveStart && t <= liveEnd);
    }

    function isActive() external view override returns (bool) {
        return inAuctionWindow() || inLiveWindow();
    }

    function activateIfReady() external override {
        require(_state == State.Auction, "Proposal: not Auction");

        IDutchAuction A = IDutchAuction(approveAuction);
        IDutchAuction R = IDutchAuction(rejectAuction);

        bool timeOver   = (block.timestamp >= auctionEnd);
        bool minReached = (A.sold() >= minSupplySold && R.sold() >= minSupplySold);
        bool maxHit     = (A.sold() >= maxSupply && R.sold() >= maxSupply);

        require((timeOver && minReached) || maxHit, "Proposal: not ready");

        liveStart = block.timestamp;
        liveEnd   = liveStart + liveDuration;

        _state = State.Live;
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


    event ProposalActivated(uint256 indexed id, uint256 liveStart, uint256 liveEnd);
    event ProposalResolved(uint256 indexed id, uint256 when);
}