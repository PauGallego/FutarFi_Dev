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
import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
 

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
    string  public subjectToken;
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
    IPyth pyth;
    address public pythAddr;
    bytes32 public priceFeedId;


    bool private _initialized;

    event ProposalActivated(uint256 indexed id, uint256 liveStart, uint256 liveEnd);
    event ProposalResolved(uint256 indexed id, uint256 when);
    event ProposalCancelled(uint256 when);
    event ProposalLive(uint256 liveEnd);

    constructor() Ownable(msg.sender) {}

    function initialize(
        uint256 _id,
        address _admin,
        string memory _title,
        string memory _description,
        uint256 _auctionDuration,
        uint256 _liveDuration,
        string memory _subjectToken,
        address _pyUSD,
        uint256 _minToOpen,
        uint256 _maxCap,
        address _target,
        bytes memory _data,
        address _pythContract,
        bytes32 _priceFeedId
    ) external {
        require(!_initialized, "Already initialized");
        require(_admin != address(0), "Invalid admin");
        require(_pyUSD != address(0), "Invalid pyUSD");
        require(_pythContract != address(0), "Invalid Pyth address");

        require(_minToOpen < _maxCap, "Invalid min/max");
        require(_auctionDuration > 0 && _auctionDuration <= 7 days, "Invalid auction duration");
        require(_liveDuration > 0 && _liveDuration <= 30 days, "Invalid live duration");

        _initialized = true;

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
        pyth = IPyth(_pythContract);
        priceFeedId = _priceFeedId;

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

        int64 initialPrice = getPythPriceFeed(priceFeedId);
        console.log("Initial price: ", initialPrice);

        // Deploy Dutch auctions for YES and NO (require token addresses in constructor)
        yesAuction = new DutchAuction(
            pyUSD,
            address(yesToken),
            address(treasury),
            _auctionDuration,
            initialPrice, // pyth: initial token price
            minToOpen,
            admin
        );

        noAuction = new DutchAuction(
            pyUSD,
            address(noToken),
            address(treasury),
            _auctionDuration,
            initialPrice,   // pyth: initial token price
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


    // Get the initial Pyth price feed info for the proposal's subject asset
    function getPythPriceFeed(bytes32 _priceFeedId) private view returns (int64) {

        PythStructs.Price memory price = pyth.getPriceUnsafe(_priceFeedId);
        return price.price;
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