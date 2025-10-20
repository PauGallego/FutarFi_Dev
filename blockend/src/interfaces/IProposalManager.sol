// SPDX-License-Identifier: MIT

pragma solidity ^0.8.30;


interface IProposalManager {
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