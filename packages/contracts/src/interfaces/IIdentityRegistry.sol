// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @title IIdentityRegistry
/// @notice OnchainID-based KYC/AML registry used by ERC-3643 (T-REX) transfers.
interface IIdentityRegistry {
    /// @notice Whether the wallet completed KYC/AML and is bound to a live OnchainID.
    function isVerified(address investor) external view returns (bool);

    /// @notice Canonical OnchainID contract (or identity key) bound to the wallet.
    function investorOnchainID(address investor) external view returns (address);
}
