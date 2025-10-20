// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";

interface IProposal {
    enum State { Auction, Live, Resolved, Cancelled }

    // -------- Init / lifecycle --------
    function initialize(
        uint256 _id,
        address _admin,
        string calldata _title,
        string calldata _description,
        // auction timing
        uint256 _tStart,
        uint256 _tEnd,
        // payment + supply limits
        address _payUSD,
        uint256 _minSold,
        uint256 _maxSupply,
        // external impls/infra
        address _oracleAdapter,
        address _optionsAdapter,
        address _escrowImpl,
        address _twapImpl,
        address _settlementImpl,
        // auction + tokens pre-cloned by manager:
        address _approveAuction,
        address _rejectAuction,
        address _tokenApprove,
        address _tokenReject,
        // attestor (TEE) simple for now (no roles)
        address _attestor,
        address _liveDuration
    ) external;

    function activateIfReady() external;
    function resolve() external;

    // optional proxies (onlyAttestor for now)
    function applyBatch(bytes calldata batch, bytes calldata sig) external;
    function pushPriceSnapshot(uint256 px, uint256 ts) external;

    // -------- Views --------
    function state() external view returns (State);
    function isActive() external view returns (bool); // Auction && now in window

    function id() external view returns (uint256);
    function admin() external view returns (address);
    function title() external view returns (string memory);
    function description() external view returns (string memory);
    function startTime() external view returns (uint256);
    function endTime() external view returns (uint256);

    function payUSD() external view returns (address);
    function minSupplySold() external view returns (uint256);
    function maxSupply() external view returns (uint256);

    function approveAuction() external view returns (address);
    function rejectAuction() external view returns (address);
    function tokenApprove() external view returns (address);
    function tokenReject() external view returns (address);

    function escrow() external view returns (address);
    function twap() external view returns (address);
    function settlement() external view returns (address);
    function oracleAdapter() external view returns (address);
    function optionsAdapter() external view returns (address);
    function attestor() external view returns (address);

    function auctionStart() external view returns (uint256);
    function auctionEnd() external view returns (uint256);
    function liveStart() external view returns (uint256);
    function liveEnd() external view returns (uint256);
    function liveDuration() external view returns (uint256);

    function inAuctionWindow() external view returns (bool);
    function inLiveWindow() external view returns (bool);

}
