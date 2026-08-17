// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @title GovOracleBridge
/// @notice Demo Smart Bridge surface for data-room hash anchors and EGKN cadastre status.
///         Production mint gating remains on `GovOracle.verifyCadastreProof`.
contract GovOracleBridge {
    mapping(string => bytes32) private documentHashes;

    struct CadastreStatus {
        uint8 status;
        bytes32 hash;
        uint256 updatedAt;
    }

    mapping(string => CadastreStatus) public cadastre;

    event DocumentHashSet(string docId, bytes32 hash);
    event CadastreStatusUpdated(string cadastreId, uint8 status, bytes32 hash);

    error EmptyDocId();
    error EmptyCadastreId();
    error ZeroHash();

    function getDocumentHash(
        string calldata docId
    ) external view returns (bytes32) {
        return documentHashes[docId];
    }

    function setDocumentHash(
        string calldata docId,
        bytes32 hash
    ) external {
        if (bytes(docId).length == 0) revert EmptyDocId();
        if (hash == bytes32(0)) revert ZeroHash();
        documentHashes[docId] = hash;
        emit DocumentHashSet(docId, hash);
    }

    /// @param status 1 = CLEAN / unencumbered (demo enum used by the issuer mint console).
    function updateCadastreStatus(
        string calldata cadastreId,
        uint8 status,
        bytes32 hash
    ) external {
        if (bytes(cadastreId).length == 0) revert EmptyCadastreId();
        if (hash == bytes32(0)) revert ZeroHash();
        cadastre[cadastreId] = CadastreStatus({status: status, hash: hash, updatedAt: block.timestamp});
        emit CadastreStatusUpdated(cadastreId, status, hash);
    }
}
