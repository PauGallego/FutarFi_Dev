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
        if (block.timestamp < endTime) revert Proposal_NotEnded();
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
        address _pythAddr,
        bytes32 _pythId,
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
            _pythAddr,
            _pythId,
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
    function checkWinner() internal view returns(bool) {
        uint256 priceMarketApprove = market.getMarketTypePrice(0);
        uint256 priceMarketReject = market.getMarketTypePrice(1);
        
        // If prices are equal, no execution (neither side wins)
        if (priceMarketApprove == priceMarketReject) {
            return false; // No execution when prices are equal
        }
        
        return priceMarketApprove > priceMarketReject;
    }


    /// @notice Settle market and optionally execute target call when Approve wins
    function _executeProposal(bool isApproveWinner) 
        private 
        onlyOwner 
    {
        if (proposalExecuted) revert Proposal_AlreadyExecuted();

        // Check if prices are equal (no clear winner)
        uint256 priceMarketApprove = market.getMarketTypePrice(0);
        uint256 priceMarketReject = market.getMarketTypePrice(1);
        
        if (priceMarketApprove == priceMarketReject) {
            // Equal prices - complete revert, everyone gets original collateral back
            market.revertMarket();
            proposalExecuted = true;
            proposalEnded = true;
            return;
        }

        // Settle the market with the determined winner
        market.settleMarket(isApproveWinner);

        if(isApproveWinner && target != address(0) && data.length > 0){
            // Execute the call only when Approve side wins
            (bool success, bytes memory result) = target.call(data);
            if (!success) revert Proposal_ExecutionFailed();
            emit ProposalExecuted(msg.sender, result);
        }
        
        proposalExecuted = true;
        proposalEnded = true;
    }


    // Check if proposal is active
    function isActive() external view returns(bool){
        return block.timestamp >= startTime && block.timestamp <= endTime && !proposalEnded;
    }


}
