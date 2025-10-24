// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IProposal} from "../interfaces/IProposal.sol";
import {Proposal} from "./Proposal.sol";
import {IProposalManager} from "../interfaces/IProposalManager.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

/// @title ProposalManager
/// @notice Deploys Proposal contracts and indexes them for discovery by ID and admin.

contract ProposalManager is Ownable, IProposalManager {
    address public immutable PYUSD;       // Collateral/stable used by auctions/treasury
    address public immutable ATTESTOR; 
    address public proposalImpl;

    // --- Indexing ---
    uint256 public nextId;
    address[] public allProposals;
    mapping(uint256 => address) public proposals;              // id => proposal address

    // --- Events ---
    event ProposalCreated(uint256 indexed id, address indexed admin, address proposal, string title);

    constructor(address _pyusd, address _proposalImpl, address _attestor) Ownable(msg.sender) {
        require(_pyusd != address(0), "PM:PYUSD=0");
        PYUSD = _pyusd;
        proposalImpl = _proposalImpl;
        ATTESTOR = _attestor;
    }

    /// @param _title Proposal title
    /// @param _description Text description
    /// @param _auctionDuration Auction duration in seconds (also used as Live duration for now)
    /// @param _liveDuration Live duration in seconds
    /// @param _subjectToken Subject token under evaluation (treated as subjectToken)
    /// @param _maxCap Max cap for each market token (18 decimals)
    /// @param _target Unused placeholder (kept for ABI compatibility)
    /// @param _data Unused placeholder (kept for ABI compatibility)
    /// @param _pythAddr Unused placeholder (kept for ABI compatibility)
    /// @param _pythId Unused placeholder (kept for ABI compatibility)
    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _auctionDuration,
        uint256 _liveDuration,
        string memory _subjectToken,
        uint256 _minToOpen,
        uint256 _maxCap,
        address _target,
        bytes memory _data,
        address _pythAddr,
        bytes32 _pythId
    ) external returns (uint256 id) {
        require(_auctionDuration > 0, "PM:duration=0");
        require(_liveDuration > 0, "PM:duration=0");
        require(_maxCap > 0, "PM:max=0");

        id = ++nextId;

        // deploy a new Proposal
        address proposalClone = Clones.clone(proposalImpl);
        Proposal(proposalClone).initialize(
            id,
            msg.sender,
            _title,
            _description,
            _auctionDuration,
            _liveDuration,
            _subjectToken,
            PYUSD,
            _minToOpen,
            _maxCap,
            _target,
            _data,
            _pythAddr,
            _pythId,
            ATTESTOR
        );
      

        // Indexing
        address proposalAddr = address(Proposal(proposalClone));
        proposals[id] = proposalAddr;
        allProposals.push(proposalAddr);
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
        uint256 count = 0;
        for (uint256 i = 0; i < allProposals.length; i++) {
            if (IProposal(allProposals[i]).admin() == _admin) count++;
        }
        address[] memory result = new address[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < allProposals.length; i++) {
            address p = allProposals[i];
            if (IProposal(p).admin() == _admin) result[j++] = p;
        }
        return result;
    }
}
