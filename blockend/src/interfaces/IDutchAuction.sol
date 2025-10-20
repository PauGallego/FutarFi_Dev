// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IDutchAuction {
    function initialize(
        address payUSD,
        address tokenToMint,
        uint256 tStart,
        uint256 tEnd,
        uint256 basePrice,     
        uint256 minSupplySold, // min sold to activate
        uint256 maxSupply,     // hard cap
        address proposal       // back-reference
    ) external;

    function sold() external view returns (uint256);
    function minSupplySold() external view returns (uint256);
    function maxSupply() external view returns (uint256);
}
