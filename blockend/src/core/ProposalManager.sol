// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IProposal} from "../interfaces/IProposal.sol";
import {Proposal} from "./Proposal.sol";

/// @title ProposalManager
/// @notice Deploys Proposal contracts and indexes them for discovery by ID and admin.
/// @dev Keeps a simple registry; each Proposal is a standalone contract that internally deploys its auctions/tokens.
contract ProposalManager is Ownable {
    // --- Immutable/Config ---
    address public immutable PYUSD;       // Collateral/stable used by auctions/treasury

    // --- Indexing ---
    uint256 public nextId;
    address[] public allProposals;
    mapping(uint256 => address) public proposals;              // id => proposal address

    // --- Events ---
    event ProposalCreated(uint256 indexed id, address indexed admin, address proposal, string title);

    constructor(address _pyusd, address _escrowImpl) Ownable(msg.sender) {
        require(_pyusd != address(0), "PM:PYUSD=0");
        require(_escrowImpl != address(0), "PM:ESCROW=0");
        PYUSD = _pyusd;
    }

    /// @param _title Proposal title
    /// @param _description Text description
    /// @param _duration Auction duration in seconds (also used as Live duration for now)
    /// @param _subjectToken Subject token under evaluation (treated as subjectToken)
    /// @param _maxSupply Max cap for each market token (18 decimals)
    /// @param _target Unused placeholder (kept for ABI compatibility)
    /// @param _data Unused placeholder (kept for ABI compatibility)
    /// @param _pythAddr Unused placeholder (kept for ABI compatibility)
    /// @param _pythId Unused placeholder (kept for ABI compatibility)
    /// @return id Newly assigned proposal ID
    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _duration,
        address _subjectToken,
        uint256 _maxSupply,
        address _target,
        bytes memory _data,
        address _pythAddr,
        bytes32 _pythId
    ) external returns (uint256 id) {
        // Silence unused variables for now; kept for forward-compatibility with the frontend flow.
        (_target, _data, _pythAddr, _pythId);

        require(_subjectToken != address(0), "PM:subject=0");
        require(_duration > 0, "PM:duration=0");
        require(_maxSupply > 0, "PM:max=0");

        id = ++nextId;

   

        // deploy a new Proposal 
        Proposal proposal = new Proposal(
            id,
            msg.sender,
            _title,
            _description,
            _duration,     // auction duration
            _duration,     // live duration (mirrors auction duration for now)
            _subjectToken,
            minToOpen,
            PYUSD,
            minToOpen,
            _maxSupply
        );

        // Indexing
        address proposalAddr = address(proposal);
        proposals[id] = proposalAddr;
        allProposals.push(proposalAddr);
        proposalsByAdmin[msg.sender].push(proposalAddr);

        emit ProposalCreated(id, msg.sender, proposalAddr, _title);
    }

    /// @notice Proxy a finalize/settle step to the proposal during the Auction phase.
    /// @dev Current Proposal exposes settleAuctions(); this triggers state transition if ready.
    function finalizeProposal(uint256 _proposalId) external {
        address proposal = proposals[_proposalId];
        require(proposal != address(0), "PM:unknown-id");
        IProposal(proposal).settleAuctions();
    }

    // --- Views (ABI compatibility with frontend) ---
    function getProposalById(uint256 _proposalId) external view returns (address proposal) {
        proposal = proposals[_proposalId];
    }

    function getAllProposals() external view returns (address[] memory proposals_) {
        proposals_ = allProposals;
    }

    function getProposalsByAdmin(address _admin) external view returns (address[] memory) {
        return proposalsByAdmin[_admin];
    }
}
