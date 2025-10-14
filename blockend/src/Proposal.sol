// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Market} from "./Market.sol";

interface IProposal {
    function closeProposal() external;
    function isActive() external view returns(bool);
    function getAdmin() external view returns(address);
    function getName() external view returns(string memory);
    function getDescription() external view returns(string memory);
    function getStartTime() external view returns(uint256);
    function getEndTime() external view returns(uint256);
    function getMarketAddress() external view returns(address);
    function isExecuted() external view returns(bool);
}

contract Proposal is Ownable, IProposal {

    uint256 public id;
    address public admin; 
    string public name;
    string public description;
    uint256 public startTime;
    uint256 public endTime;
    bool public proposalExecuted;
    bool public proposalEnded;
    Market public market; 

    // Execution
    address public target;     
    bytes public data;       

    // Events
    event ProposalExecuted(address executor, bytes result);

    // Errors
    error Proposal_NotEnded();
    error Proposal_AlreadyExecuted();
    error Proposal_ExecutionFailed();


    modifier checkEnded() {
        if (block.timestamp >= endTime) revert Proposal_NotEnded();
        _;
    }



    constructor(
        uint256 _id,
        address _admin,
        string memory _name,
        string memory _description,
        uint256 _duration,            
        IERC20 _collateral,           
        string memory _approveName,
        string memory _approveSymbol,
        string memory _rejectName,
        string memory _rejectSymbol,
        uint256 _maxSupply,
        address _target,
        bytes memory _data
    ) Ownable(_admin) {
        id = _id;
        admin = _admin;
        name = _name;
        description = _description;
        startTime = block.timestamp;
        endTime = startTime + _duration; // Duration in seconds

        // Create Market automatically
        market = new Market(
            _collateral,
            _approveName,
            _approveSymbol,
            _rejectName,
            _rejectSymbol,
            _maxSupply,
            address(0), // TODO: Implement pyth in this contract
            bytes32(""), 
            bytes32("")
        );

        target = _target; 
        data = _data;

        proposalExecuted = false;
        proposalEnded = false;
    }

    function closeProposal() external onlyOwner checkEnded {
        if (proposalExecuted) revert Proposal_AlreadyExecuted();

        bool approveWins = checkWinner();

        _executeProposal(approveWins);
    }

      
    // Check winner without settling
    function checkWinner() internal view checkEnded returns(bool) {
        uint256 priceMarketApprove = 2;
        uint256 priceMarketReject = 1;
        
        return priceMarketApprove > priceMarketReject;
       
    }


    /// @notice Settle market and optionally execute target call when Approve wins
    function _executeProposal(bool isApproveWinner) 
        private 
        onlyOwner 
        checkEnded 
    {
        if (proposalExecuted) revert Proposal_AlreadyExecuted();

        // Settle the market
        market.settleMarket(isApproveWinner);

        if(isApproveWinner && target != address(0) && data.length > 0){
            // Execute the call, Proposal has callData and target
            (bool success, bytes memory result) = target.call(data);
            require(success, "Execution failed");
            emit ProposalExecuted(msg.sender, result);
            proposalExecuted = true;
        }else {
            // When reject market wins or no execution data is provided in Approve win case
            // No execution, just mark as executed
            proposalExecuted = true;
        }
        proposalEnded = true;

    }

   

    // Check if proposal is active
    function isActive() external view returns(bool){
        return block.timestamp >= startTime && block.timestamp <= endTime && !proposalEnded;
    }

    function getAdmin() external view returns(address) {
        return admin;
    }

    function getName() external view returns(string memory) {
        return name;
    }

    function getDescription() external view returns(string memory) {
        return description;
    }

    function getStartTime() external view returns(uint256) {
        return startTime;
    }

    function getEndTime() external view returns(uint256) {
        return endTime;
    }

    function getMarketAddress() external view returns(address) {
        return address(market);
    }

    function isExecuted() external view returns(bool) {
        return proposalExecuted;
    }

   

}
