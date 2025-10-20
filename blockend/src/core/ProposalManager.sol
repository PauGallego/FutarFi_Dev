// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {IProposal} from "../interfaces/IProposal.sol";
import {IDutchAuction} from "../interfaces/IDutchAuction.sol";
import {IMarketToken} from "../interfaces/IMarketToken.sol";

interface IMarketTokenImpl {
    function initializeToken(string calldata name_, string calldata symbol_, address owner_, address minter_) external;
}

/// @title ProposalManager
/// @notice Creates proposals and indexes them. 
///         After creation, Proposal becomes the owner of YES/NO tokens. Manager only keeps indexes/getters.
contract ProposalManager is Ownable {
    // --- Implementation addresses (set at deploy or via setters) ---
    address public proposalImpl;      // logic for Proposal (clone target)
    address public dutchAuctionImpl;  // logic for DutchAuction (clone target)
    address public marketTokenImpl;   // logic for MarketToken (clone target)
    address public escrowImpl;        // logic for Escrow 

    uint256 public nextId;
    address[] public allProposals;
    mapping(uint256 => address) public proposals;

    // --- Events ---
    event ImplementationsUpdated(address proposalImpl,address dutchAuctionImpl,address marketTokenImpl);

    event ProposalCreated(
        uint256 indexed id,
        address indexed admin,
        address proposal,
        address tokenYes,
        address tokenNo,
        address auctionYes,
        address auctionNo
    );

    constructor(
        address _proposalImpl,
        address _dutchAuctionImpl,
        address _marketTokenImpl,
        address _escrowImpl,
    ) {
        proposalImpl     = _proposalImpl;
        dutchAuctionImpl = _dutchAuctionImpl;
        marketTokenImpl  = _marketTokenImpl;
        escrowImpl     = _escrowImpl;
    }

    function setImplementations(
        address _proposalImpl,
        address _dutchAuctionImpl,
        address _marketTokenImpl,
        address _escrowImpl
    ) external onlyOwner {
        proposalImpl     = _proposalImpl;
        dutchAuctionImpl = _dutchAuctionImpl;
        marketTokenImpl  = _marketTokenImpl;
        escrowImpl      = _escrowImpl;
        emit ImplementationsUpdated(_proposalImpl, _dutchAuctionImpl, _marketTokenImpl, _escrowImpl);
    }

    /// @notice Create a full proposal with YES/NO tokens and Dutch auctions (clone-based).
    function createProposal(
        string  title;
        string  description;
        uint256 auctionDuration;
        uint256 liveDuration;
        address subjectToken;
        uint256 minSupplySold;
        uint256 maxSupply;
        uint256 basePrice;
        address attestor;
    ) external returns (uint256 id) {
        require(proposalImpl != address(0) && dutchAuctionImpl != address(0) && marketTokenImpl != address(0), "PM: impl unset");
        require(p.payUSD != address(0), "PM: payUSD=0");
        require(p.auctionEnd > p.auctionStart, "PM: bad window");
        require(p.liveDuration > 0, "PM: live=0");

        id = ++nextId;

        // 1) Clone Proposal
        address clone = Clones.clone(proposalImpl);

        // 3) Clone DutchAuction YES/NO
        address auctionYes = Clones.clone(dutchAuctionImpl);
        address auctionNo  = Clones.clone(dutchAuctionImpl);

        IDutchAuction(auctionYes).initialize(
            p.payUSD, 
            tokenYes,
            p.auctionStart, 
            p.auctionEnd,
            p.basePrice, 
            p.minSupplySold, 
            p.maxSupply,
            proposalAddr
        );
        IDutchAuction(auctionNo).initialize(
            p.payUSD, 
            tokenNo,
            p.auctionStart, 
            p.auctionEnd,
            p.basePrice, 
            p.minSupplySold, 
            p.maxSupply,
            proposalAddr
        );

        // 4) Set final minters and transfer token ownership to Proposal
        IMarketToken(tokenYes).setMinter(auctionYes);
        IMarketToken(tokenNo).setMinter(auctionNo);
        IMarketToken(tokenYes).transferOwnership(proposalAddr);
        IMarketToken(tokenNo).transferOwnership(proposalAddr);

        // 5) Initialize Proposal with all addresses/params
        IProposal(proposalAddr).initialize(
            id,
            msg.sender,          // admin/creator
            p.title,
            p.description,
            p.auctionStart,
            p.auctionEnd,
            p.payUSD,
            p.minSupplySold,
            p.maxSupply,
            oracleAdapter,
            optionsAdapter,
            escrowImpl,
            twapImpl,
            settlementImpl,
            auctionYes,
            auctionNo,
            tokenYes,
            tokenNo,
            p.attestor,
            p.liveDuration
        );

        // 6) Indexing
        byId[id] = ProposalInfo({
            proposal:   proposalAddr,
            tokenYes:   tokenYes,
            tokenNo:    tokenNo,
            auctionYes: auctionYes,
            auctionNo:  auctionNo,
            admin:      msg.sender,
            title:      p.title
        });

        byAdmin[msg.sender].push(id);
        allProposals.push(proposalAddr);

        emit ProposalCreated(id, msg.sender, proposalAddr, tokenYes, tokenNo, auctionYes, auctionNo);
    }

    // --- Getters for UI ---
    function getProposalById(uint256 id) external view returns (ProposalInfo memory) {
        return byId[id];
    }

    function getAllProposals() external view returns (address[] memory) {
        return allProposals;
    }

    function getProposalsByAdmin(address admin) external view returns (uint256[] memory) {
        return byAdmin[admin];
    }

    // --- Internal helpers ---
    function _initializeMarketToken(
        address token,
        string memory name_,
        string memory symbol_,
        address owner_,
        address minter_
    ) internal {
        // If your MarketToken uses constructors (not upgradeable), replace this with a custom factory,
        // or provide an initializer and call it here via a small interface (see IMarketTokenImpl).
        // For simplicity, many teams keep MarketToken as a normal contract (no clone) to avoid init.
        // If you *do* have an initializer, uncomment and implement it in MarketTokenImpl:
        // IMarketTokenImpl(token).initializeToken(name_, symbol_, owner_, minter_);
        // Otherwise, deploy MarketToken directly instead of cloning.
        (name_, symbol_, owner_, minter_); // silence warnings if you haven't wired init yet
        revert("PM: MarketToken clone requires initializeToken(...) on impl or deploy directly");
    }

    // Tiny integer-to-string + concat for symbols/names
    function _u(uint256 x) internal pure returns (string memory) {
        if (x == 0) return "0";
        uint256 j = x; uint256 len;
        while (j != 0) { len++; j /= 10; }
        bytes memory b = new bytes(len);
        uint256 k = len;
        while (x != 0) { k--; b[k] = bytes1(uint8(48 + x % 10)); x /= 10; }
        return string(b);
    }

    function _concat(string memory a, string memory b) internal pure returns (string memory) {
        return string(abi.encodePacked(a, b));
    }
}
