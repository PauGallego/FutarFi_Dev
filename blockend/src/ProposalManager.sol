// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Proposal} from "./Proposal.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IProposalManager {
    function createDAO(string calldata name, address[] calldata initialAdmins) external returns (uint256 id);
    function addAdmin(uint256 daoId, address newAdmin) external;
    function removeAdmin(uint256 daoId, address admin) external;
    function createProposal(uint256 daoId, string memory title, string memory description, uint256 duration) external;
    function removeProposal(uint256 daoId, uint256 proposalId) external;
    function voteOnProposal(uint256 daoId, uint256 proposalId, uint8 voteType) external;
    function executeProposal(uint256 daoId, uint256 proposalId) external;
    function getProposal(uint256 daoId, uint256 proposalId) external view returns (Proposal proposal);
    function getAllProposals(uint256 daoId) external view returns (Proposal[] memory);
}

contract ProposalManager is IProposalManager, Ownable {

    struct mockDAO {
        // Identity
        string  name;              // human-readable name
        // address daoAddress;        
        // string  metadataURI;       
        uint64  createdAt;         // creation timestamp
        bool    exists;            // sentinel to validate ids

        // Governance
        address[] admins;          // enumerable list of admins 
        mapping(address => bool) isAdmin;     // O(1) admin membership

        // Proposals
        address[] proposals;                 // addresses of Proposal instances
    }

    /// @notice Primary store: id => mockDAO.
    mapping(uint256 => mockDAO) private daos;

    /// @notice Enumerability index for DAOs.
    uint256[] private daoIds;

    /// @notice Total number of DAOs ever created (also used to mint the next id).
    uint256 public daoCount;

    /// @dev Reference count: if for checking if `addr` (msg.sender) is admin of any mockDAO.
    mapping(address => uint256) private adminRefCount;

    // ------ Events ------
    event DAOCreated(uint256 indexed daoId, string name);
    event DAOAdminAdded(uint256 indexed daoId, address indexed admin);
    event DAOAdminRemoved(uint256 indexed daoId, address indexed admin);
    event ProposalRegistered(uint256 indexed daoId, address indexed proposal);
    event ProposalVoted(uint256 indexed daoId, uint256 indexed proposalId, address indexed voter, uint8 voteType);
    event ProposalExecuted(uint256 indexed daoId, uint256 indexed proposalId);

    modifier onlyAdmin() {
        //msg.sender needs to be an admin of a mockDAO
        require(adminRefCount[msg.sender] > 0, "Not admin of any mockDAO");
        _;
    }

    constructor() Ownable(msg.sender) {
        daoCount = 0;
    }

    /// @notice Creates a new mockDAO and returns its id
    /// @param name Human-readable name.
    /// @param initialAdmins Initial admin addresses to seed into `admins`/`isAdmin`.
    function createDAO(
        string calldata name,
        // address daoAddr,
        // string calldata uri,
        address[] calldata initialAdmins
    ) external onlyOwner returns (uint256 id) {
        // require(daoAddr != address(0), "daoAddr=0");

        uint256 newId = ++daoCount;
        mockDAO storage d = daos[newId];
        require(!d.exists, "id already used");

        // Identity
        d.exists     = true;
        d.name       = name;
        // d.daoAddress = daoAddr;
        // d.metadataURI= uri;
        d.createdAt  = uint64(block.timestamp);

        // Seed admins (avoid duplicates)
        for (uint256 i = 0; i < initialAdmins.length; ++i) {
            address a = initialAdmins[i];

            /// @NOTE only add an admin if its not already admin of another DAO (for testing purposes)
            _addAdmin(newId, a);
        }

        daoIds.push(newId);
        emit DAOCreated(newId, name);
        return newId;
    }

    function addAdmin(uint256 daoId, address newAdmin) external onlyAdmin{
        _addAdmin(daoId, newAdmin);
    }

    function _addAdmin(uint256 daoId, address newAdmin) internal onlyAdmin {
        mockDAO storage d = getDAObyId(daoId);

        // TODO: Gas optimization --> CustomError
        if (!d.exists) revert("mockDAO does not exist");
        if (newAdmin == address(0)) revert("newAdmin=0");
        if (d.isAdmin[newAdmin]) revert("already admin");
        // only an existing admin can add another admin
        if (!d.isAdmin[msg.sender]) revert("not admin of this mockDAO");

        d.isAdmin[newAdmin] = true;
        adminRefCount[newAdmin]++;
        d.admins.push(newAdmin);
        emit DAOAdminAdded(daoId, newAdmin);
    }

    function removeAdmin(uint256 daoId, address adminToRemove) external onlyAdmin(){
        mockDAO storage d = getDAObyId(daoId);

        // TODO: Gas optimization --> CustomError
        if (!d.exists) revert("mockDAO does not exist");
        if (adminToRemove == address(0)) revert("adminToRemove=0");
        if (!d.isAdmin[adminToRemove]) revert("not admin");
        // only an existing admin can remove another admin
        if (!d.isAdmin[msg.sender]) revert("not admin of this mockDAO");

        d.isAdmin[adminToRemove] = false;
        adminRefCount[adminToRemove]--;
        emit DAOAdminRemoved(daoId, adminToRemove);
    }


    function getDAObyId(uint256 daoId) internal view returns (mockDAO storage d) {
        d = daos[daoId];
    }

    function getAllDAOIds() internal view returns (uint256[] memory) {
        return daoIds;
    }


    function createProposal(uint256 daoId, string memory title, string memory description, uint256 duration) external {
        // emit ProposalRegistered(daoId, <proposalAddress>); 
    }

    function removeProposal(uint256 daoId, uint256 proposalId) external {
        // emit ProposalRemoved(daoId, proposalId);
    }

    function voteOnProposal(uint256 daoId, uint256 proposalId, uint8 voteType) external {
        // emit ProposalVoted(daoId, proposalId, msg.sender, voteType);
    }

    function executeProposal(uint256 daoId, uint256 proposalId) external {
        // emit ProposalExecuted(daoId, proposalId);
    }

    function getProposal(uint256 daoId, uint256 proposalId) external view onlyAdmin returns (Proposal proposal) {
    }

    function getAllProposals(uint256 daoId) external view onlyAdmin returns (Proposal[] memory) {
    }
}
