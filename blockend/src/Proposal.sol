// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";
import {Market} from "./Market.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

interface IProposal {
    function closeProposal() external;
    function isActive() external view returns(bool);
}

contract Proposal is Ownable, IProposal {
    bool private _initialized;

    uint256 public id;
    address public admin; 
    string public name;
    string public description;
    uint256 public startTime;
    uint256 public endTime;
    string public approveName;
    string public approveSymbol;
    string public rejectName;
    string public rejectSymbol;
    bool public proposalExecuted;
    bool public proposalEnded;
    Market public market;
    address public marketImpl; 
    address public marketTokenImpl;

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



    constructor() Ownable(msg.sender) {}

    function initialize(
        uint256 _id,
        address _admin,
        string memory _name,
        string memory _description,
        uint256 _duration,
        IERC20 _collateralToken,
        uint256 _maxSupply,
        address _target,
        bytes memory _data,
        address _marketImpl,
        address _marketTokenImpl
    ) external {
        require(!_initialized, "Already initialized");
        _initialized = true;

        id = _id;
        admin = _admin;
        name = _name;
        description = _description;
        startTime = block.timestamp;
        endTime = block.timestamp + _duration;
        target = _target;
        data = _data;

        marketImpl = _marketImpl;
        marketTokenImpl = _marketTokenImpl;

        // Clone Market and initialize
        address m = Clones.clone(marketImpl);
        Market(m).initialize(
            _collateralToken,
            _maxSupply,
            address(0),
            bytes32(""),
            _marketTokenImpl
        );
        market = Market(m);

        _transferOwnership(msg.sender); // set the proxy owner to caller of initialize()
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


}
