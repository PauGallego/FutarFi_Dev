// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Proposal} from "./Proposal.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IProposalManager {
    // TODO: function addAdmin(uint256 proposalId, address newAdmin) external;
    // TODO: function removeAdmin(uint256 proposalId, address admin) external;
    function createProposal(
        string memory _name,
        string memory _description,
        uint256 _duration,
        address _collateral,
        string memory _approveName,
        string memory _approveSymbol,
        string memory _rejectName,
        string memory _rejectSymbol,
        uint256 _maxSupply,
        address _target,
        bytes memory _data
    ) external returns (uint256);
    // function removeProposal(uint256 _proposalId) external;
    function finalizeProposal(uint256 _proposalId) external;
    function getProposalById(uint256 _proposalId) external view returns (address proposal);
    function getAllProposals() external view returns (address[] memory proposals);
    function getProposalsByAdmin(address _admin) external view returns (address[] memory);
}

contract ProposalManager is IProposalManager, Ownable {

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
    event ProposalRegistered(address indexed proposal);
    event ProposalExecuted(uint256 indexed proposalId);

    modifier onlyAdmin() {
        require(adminRefCount[msg.sender] > 0, "Not admin of any Proposal");
        _;
    }

    constructor() Ownable(msg.sender) {
        proposalCount = 0;
    }

    

    function createProposal(
        string memory _name,
        string memory _description,
        uint256 _duration,
        address _collateral,
        string memory _approveName,
        string memory _approveSymbol,
        string memory _rejectName,
        string memory _rejectSymbol,
        uint256 _maxSupply,
        address _target,
        bytes memory _data
    ) external override returns (uint256) {
        Proposal newProposal = new Proposal(
            proposalCount++,
            msg.sender,
            _name,
            _description,
            _duration,
            IERC20(_collateral),
            _approveName,
            _approveSymbol,
            _rejectName,
            _rejectSymbol,
            _maxSupply,
            _target,
            _data
        );
        proposals[proposalCount] = address(newProposal);
        proposalIds.push(proposalCount);
        emit ProposalRegistered(address(newProposal));
        return proposalCount;
    }
    
    // NOTE: maybe not needed, as proposals are immutable once created
    // function removeProposal(uint256 _proposalId) external override {
    //     emit ProposalRemoved(proposalId, _proposalId);
    // }

    // TODO: extra verifications for security
    function finalizeProposal(uint256 _proposalId) external override {
        Proposal p = Proposal(proposals[_proposalId]);
        p.closeProposal();
        emit ProposalExecuted(_proposalId);
    }

    // ---- View functions ----

    function getProposalById(uint256 _proposalId)
        external
        view
        override
        onlyAdmin
        returns (address proposal)
    {
        return proposals[_proposalId];
    }

    

    function getAllProposals()
        external
        view
        override
        onlyAdmin
        returns (address[] memory)
    {
        uint256 len = proposalIds.length;
        address[] memory props = new address[](len);
        for (uint256 i = 0; i < len; i++) {
            props[i] = proposals[proposalIds[i]];
        }
        return props;
    }


    function getProposalsByAdmin(address _admin)
        external
        view
        override
        returns (address[] memory)
    {
        uint256 matchesCount = 0;
        for (uint256 i = 0; i < proposalCount; i++) {
            address propAddr = proposals[i];
            if (Proposal(propAddr).getAdmin() == _admin) {
                matchesCount++;
            }
        }

        address[] memory proposalsByAdmin = new address[](matchesCount);

        uint256 idx = 0;
        for (uint256 i = 0; i < proposalCount; i++) {
            address propAddr = proposals[i];
            if (Proposal(propAddr).getAdmin() == _admin) {
                proposalsByAdmin[idx] = propAddr; 
                idx++;
            }
        }

        return proposalsByAdmin;
    }

   
}
