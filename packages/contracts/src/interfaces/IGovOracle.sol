// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @title IGovOracle
/// @notice EGKN / Smart Bridge gateway: confirms that a cadastral object is free of
///         pledge, arrest or other encumbrance before a verified mint.
interface IGovOracle {
    /// @notice Validates a cadastral proof blob against the EGKN encumbrance state.
    /// @param cadastreHash keccak256 of the canonical EGKN object identifier.
    /// @param proof ABI-encoded `(bytes32 cadastreHash, uint256 nonce, uint256 deadline, bytes signature)`.
    /// @return True only if the object is unencumbered and the proof is well-formed and unexpired.
    function verifyCadastreProof(bytes32 cadastreHash, bytes calldata proof) external view returns (bool);
}
