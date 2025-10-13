// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.30;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Market} from "./Market.sol";

interface IProposal {
    function settleAndExecute(bool isAproveWinner) external;
    function isActive() external view returns(bool);
    function getProposalInfo() external view returns(
        string memory _name,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        address _dao,
        address _market,
        bool _executed
    );
    function getMarketAddress() external view returns(address);
}

contract Proposal is Ownable {

    string public name;
    string public description;
    uint256 public startTime;
    uint256 public endTime;
    bool public executed;
    address public dao; 
    Market public market; 

    // Execution
    address public target;     
    bytes public callData;       

    // Events
    event ProposalExecuted(address executor, bytes result);

    constructor(
        address _dao,
        string memory _name,
        string memory _description,
        uint256 _duration,            
        IERC20 _collateral,           
        string memory _aproveName,
        string memory _aproveSymbol,
        string memory _rejectName,
        string memory _rejectSymbol,
        uint256 _maxSupply,
        address _target,
        bytes memory _callData
    ) Ownable(_dao) {
        dao = _dao;
        name = _name;
        description = _description;

        startTime = block.timestamp;
        endTime = startTime + _duration;

        // Create Market automatically
        market = new Market(
            0,      // Fee implementation can be added later         
            _collateral,
            _aproveName,
            _aproveSymbol,
            _rejectName,
            _rejectSymbol,
            _maxSupply
        );

        target = _target;
        callData = _callData;

        executed = false;
    }

    // Settle market and optionally execute call if approve wins
    function settleAndExecute(bool isAproveWinner) external onlyOwner {
        require(block.timestamp >= endTime, "Proposal not ended");
        require(!executed, "Already executed");

        // Settle the market
        market.settleMarket(isAproveWinner);

        // Execute call only if approve wins
        if(isAproveWinner && target != address(0) && callData.length > 0){
            (bool success, bytes memory result) = target.call(callData);
            require(success, "Execution failed");
            emit ProposalExecuted(msg.sender, result);
             executed = true;
        }

       
    }

    // Check if proposal is active
    function isActive() external view returns(bool){
        return block.timestamp >= startTime && block.timestamp <= endTime && !executed;
    }

    // Get proposal info
    function getProposalInfo() external view returns(
        string memory _name,
        string memory _description,
        uint256 _startTime,
        uint256 _endTime,
        address _dao,
        address _market,
        bool _executed
    ) {
        return (name, description, startTime, endTime, dao, address(market), executed);
    }

    function getMarketAddress() external view returns(address) {
        return address(market);
    }

        // Check winner without settling
    function _checkWinner() external view returns(bool) {
       
    }

}
