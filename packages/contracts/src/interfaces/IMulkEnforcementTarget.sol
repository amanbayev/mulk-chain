// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @title IMulkEnforcementTarget
/// @notice Surface consumed by EnforcementController (3-of-5).
interface IMulkEnforcementTarget {
    function forcedTransfer(address from, address to, uint256 amount) external returns (bool);

    function pause() external;

    function unpause() external;
}
