// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Proposal} from "./Proposal.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

interface IProposalManager {
    // TODO: function addAdmin(uint256 proposalId, address newAdmin) external;
    // TODO: function removeAdmin(uint256 proposalId, address admin) external;
    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _duration,
        address _collateralToken,
        uint256 _maxSupply,
        address _target,
        bytes memory _data,
        address _pythAddr,
        bytes32 _pythId
    ) external returns (uint256);
    // function removeProposal(uint256 _proposalId) external;
    function finalizeProposal(uint256 _proposalId) external;
    function getProposalById(uint256 _proposalId) external view returns (address proposal);
    function getAllProposals() external view returns (address[] memory proposals);
    function getProposalsByAdmin(address _admin) external view returns (address[] memory);
}

contract ProposalManager is IProposalManager, Ownable {

    address public proposalImpl;     
    address public marketImpl;       
    address public marketTokenImpl;  

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
    event ProposalExecuted(uint256 indexed proposalId);


    // ------ Errors ------
    error InvalidProposalTarget();


    modifier onlyAdmin() {
        // TODO: implement admin management
        _;
    }

    constructor(address _proposalImpl, address _marketImpl, address _marketTokenImpl)
        Ownable(msg.sender)
    {
        proposalImpl = _proposalImpl;
        marketImpl = _marketImpl;
        marketTokenImpl = _marketTokenImpl;
    }

    
    function setImplementations(address _p, address _m, address _t) external onlyOwner {
        proposalImpl = _p; 
        marketImpl = _m; 
        marketTokenImpl = _t;
    }


    

    function createProposal(
        string memory _title,
        string memory _description,
        uint256 _duration,
        address _collateralToken,
        uint256 _maxSupply,
        address _target,
        bytes memory _data,
        address _pythAddr,
        bytes32 _pythId
    ) external returns (uint256 id) {
        if(_target == address(this)) revert InvalidProposalTarget();

        id = proposalCount;

        address clone = Clones.clone(proposalImpl);
        Proposal(clone).initialize(
            id,
            msg.sender,
            _title,
            _description,
            _duration,
            IERC20(_collateralToken),
            _maxSupply,
            _target,
            _data,
            _pythAddr,
            _pythId,
            marketImpl,
            marketTokenImpl
        );

        proposals[id] = clone;
        proposalIds.push(id);
        unchecked { proposalCount = id + 1; }

        emit ProposalRegistered(id, clone);
        return id;
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
        returns (address proposal)
    {
        return proposals[_proposalId];
    }

    

    function getAllProposals()
        external
        view
        override
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
            if (Proposal(propAddr).admin() == _admin) {
                matchesCount++;
            }
        }

        address[] memory proposalsByAdmin = new address[](matchesCount);

        uint256 idx = 0;
        for (uint256 i = 0; i < proposalCount; i++) {
            address propAddr = proposals[i];
            if (Proposal(propAddr).admin() == _admin) {
                proposalsByAdmin[idx] = propAddr; 
                idx++;
            }
        }

        return proposalsByAdmin;
    }

   
}
