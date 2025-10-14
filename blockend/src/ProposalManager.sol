// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Proposal} from "./Proposal.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IProposalManager {
    function addAdmin(uint256 proposalId, address newAdmin) external;
    function removeAdmin(uint256 proposalId, address admin) external;
    function createProposal(uint256 proposalId, string memory title, string memory description, uint256 duration) external;
    function removeProposal(uint256 proposalId, uint256 proposalId) external;
    function executeProposal(uint256 proposalId, uint256 proposalId) external;
    function getProposal(uint256 proposalId, uint256 proposalId) external view returns (address proposal);
    function getAllProposals(uint256 proposalId) external view returns (address[] memory proposals);
    function getProposalInfoById(uint256 proposalId) external view returns (uint256 id);
    function getProposalIdByAdmin(address admin) external view returns (uint256);
}

contract ProposalManager is IProposalManager, Ownable {
    uint256 proposalCount;

    // Single registry of proposals by proposalId -> proposalAddress (not scoped by proposalId yet)
    mapping(uint256 => address) private proposals;

    // Enumerability index
    uint256[] private proposalIds;

    // Total proposals ever created (also next id)
    uint256 public proposalCount;

    // Admin reference count 
    mapping(address => uint256) private adminRefCount;

    // ------ Events ------
    event adminAdded(uint256 indexed proposalId, address indexed admin);
    event adminRemoved(uint256 indexed proposalId, address indexed admin);
    event ProposalRegistered(uint256 indexed proposalId, address indexed proposal);
    event ProposalExecuted(uint256 indexed proposalId, uint256 indexed proposalId);

    modifier onlyAdmin() {
        require(adminRefCount[msg.sender] > 0, "Not admin of any Proposal");
        _;
    }

    constructor() Ownable(msg.sender) {
        proposalCount = 0;
    }

    // -------- Interface impl --------

    function addAdmin(uint256 proposalId, address newAdmin) external override onlyAdmin {
        _addAdmin(proposalId, newAdmin);
    }

    function removeAdmin(uint256 proposalId, address adminToRemove) external override onlyAdmin {
        emit adminRemoved(proposalId, adminToRemove);
    }

    function createProposal(
        uint256 proposalId,
        string memory title,
        string memory description,
        uint256 duration
    ) external override {
    }

    function removeProposal(uint256 proposalId, uint256 proposalId) external override {
        // emit ProposalRemoved(proposalId, proposalId);
    }

    function executeProposal(uint256 proposalId, uint256 proposalId) external override {
        // emit ProposalExecuted(proposalId, proposalId);
    }

    // ---- View functions ----

    function getProposal(uint256 /*proposalId*/, uint256 proposalId)
        external
        view
        override
        onlyAdmin
        returns (address proposal)
    {
        return proposals[proposalId];
    }

    function getAllProposals(uint256 /*proposalId*/)
        external
        view
        override
        onlyAdmin
        returns (address[] memory addrs)
    {
    }

    function getProposalInfoById(uint256 proposalId)
        external
        view
        override
        returns (uint256 id)
    {
        return proposalId;
    }

    function getProposalIdByAdmin(address admin)
        external
        view
        override
        returns (uint256)
    {
        return adminRefCount[admin];
    }

    // -------- Internal helpers --------

    function _addAdmin(uint256 proposalId, address newAdmin) internal onlyAdmin {
        // TODO: implement admin bookkeeping per proposalId if needed
        adminRefCount[newAdmin] += 1;
        emit adminAdded(proposalId, newAdmin);
    }
}
