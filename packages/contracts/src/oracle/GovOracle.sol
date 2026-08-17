// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGovOracle} from "../interfaces/IGovOracle.sol";

/// @title GovOracle
/// @notice On-chain EGKN encumbrance registry consumed by `MulkToken.verifiedMint`.
/// @dev Off-chain Smart Bridge / cadastre.service.ts updates encumbrance flags after
///      validating the live cadastral extract. Cryptographic mint binding is enforced
///      by MulkToken via EIP-712; this contract rejects encumbered or malformed proofs.
contract GovOracle is IGovOracle, Ownable {
    mapping(bytes32 => bool) public encumbered;
    mapping(bytes32 => bool) public revoked;
    mapping(address => bool) public reporters;

    event ReporterStatusSet(address indexed reporter, bool authorized);
    event EncumbranceSet(bytes32 indexed cadastreHash, bool encumbered);
    event CadastreRevoked(bytes32 indexed cadastreHash, bool revoked);

    error NotReporter(address caller);
    error ZeroHash();
    error ZeroAddress();

    modifier onlyReporter() {
        if (!reporters[msg.sender] && msg.sender != owner()) revert NotReporter(msg.sender);
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        reporters[initialOwner] = true;
        emit ReporterStatusSet(initialOwner, true);
    }

    function setReporter(address reporter, bool authorized) external onlyOwner {
        if (reporter == address(0)) revert ZeroAddress();
        reporters[reporter] = authorized;
        emit ReporterStatusSet(reporter, authorized);
    }

    function setEncumbrance(bytes32 cadastreHash, bool isEncumbered) external onlyReporter {
        if (cadastreHash == bytes32(0)) revert ZeroHash();
        encumbered[cadastreHash] = isEncumbered;
        emit EncumbranceSet(cadastreHash, isEncumbered);
    }

    function setRevoked(bytes32 cadastreHash, bool isRevoked) external onlyReporter {
        if (cadastreHash == bytes32(0)) revert ZeroHash();
        revoked[cadastreHash] = isRevoked;
        emit CadastreRevoked(cadastreHash, isRevoked);
    }

    /// @inheritdoc IGovOracle
    function verifyCadastreProof(bytes32 cadastreHash, bytes calldata proof) external view returns (bool) {
        if (cadastreHash == bytes32(0)) return false;
        if (encumbered[cadastreHash] || revoked[cadastreHash]) return false;

        (bytes32 hashInProof,, uint256 deadline, bytes memory signature) =
            abi.decode(proof, (bytes32, uint256, uint256, bytes));

        if (hashInProof != cadastreHash) return false;
        if (block.timestamp > deadline) return false;
        if (signature.length != 65) return false;
        return true;
    }
}
