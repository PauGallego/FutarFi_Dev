// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Escrow
/// @notice Applies off-chain orderbook matches on-chain by moving real ERC20 balances.
/// @dev Requires users to grant allowance (or use permit) for both PyUSD and outcome tokens.
contract Escrow {

    // tokens
    IERC20 public  pyUSD; 
    address public attestor;            
    address public tokenYes;           
    address public tokenNo; 
    bool public initialized;  
    mapping(address => uint256) private balances;


    event AttestorUpdated(address indexed oldAttestor, address indexed newAttestor);
    event BatchApplied(uint256 ops, uint256 ts);


    error InsufficientPyUSDBalance();
    error InsufficientOutcomeBalance();

    modifier onlyAttestor() {
        require(msg.sender == attestor, "Verifier:not-attestor");
        _;
    }

    constructor() {}

    function initialize(address _pyUSD, address _tokenYes, address _tokenNo, address _attestor) external onlyAttestor {
        require(!initialized, "Verifier:already initialized");
        require(_pyUSD != address(0) && _tokenYes != address(0) && _tokenNo != address(0), "Verifier:zero");
        require(_attestor != address(0), "Verifier:attestor=0");
        pyUSD   = IERC20(_pyUSD);
        tokenYes = _tokenYes;
        tokenNo  = _tokenNo;
        attestor = _attestor;
        initialized = true;
    }

    function setAttestor(address _attestor) external onlyAttestor {
        require(_attestor != address(0), "Verifier:attestor=0");
        emit AttestorUpdated(attestor, _attestor);
        attestor = _attestor;
    }

    /// @dev One trade = buyer pays PyUSD to seller; seller delivers YES/NO to buyer.
    struct Trade {
        address seller;         // seller of outcome token
        address buyer;          // buyer of outcome token
        address outcomeToken;   // token being traded (YES/NO)
        uint256 amount;         // outcome amount (18 decimals)
        uint256 price;          // total cost in PyUSD for the amount of outcome tokens 
    }

    /// @notice Apply a batch of trades. Requires allowances set by both sides.
    function applyBatch(Trade[] calldata ops, uint256 ts) external onlyAttestor {
        for (uint256 i = 0; i < ops.length; ++i) {
            Trade calldata t = ops[i];
            require(t.seller != address(0) && t.buyer != address(0), "Verifier:zero addr");
            require(t.outcomeToken == tokenYes || t.outcomeToken == tokenNo, "Verifier:bad outcome");
            require(t.amount > 0, "Verifier:bad amounts");


            // Transfer PyUSD from buyer to seller
            require(pyUSD.transferFrom(t.buyer, t.seller, t.price), "Verifier:pyUSD xferFrom");

            // Transfer outcome token from seller to buyer (must have allowance on outcome token)
            require(IERC20(t.outcomeToken).transferFrom(t.seller, t.buyer, t.amount), "Verifier:outcome xferFrom");
        }
        emit BatchApplied(ops.length, ts);
    }
}
