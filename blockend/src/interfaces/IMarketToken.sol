// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IMarketTokenMinimal {
    function mint(address to, uint256 amount) external;
    function setMinter(address newMinter) external;
    function disableMinting() external;
    function finalizeAsLoser() external;
}
