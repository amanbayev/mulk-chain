// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @title BatchAuctionEngine
/// @notice Demo on-chain epoch settlement for the Periodic Batch Auction console.
contract BatchAuctionEngine {
    uint256 public constant ALICE_FILL = 50;

    struct Epoch {
        uint256 equilibriumPrice;
        bool settled;
        uint256 settledAt;
        uint256 aliceFill;
    }

    mapping(uint256 => Epoch) public epochs;
    uint256 public aliceBalance;

    event EpochSettled(uint256 indexed epochId, uint256 equilibriumPrice, uint256 aliceBalance);

    error ZeroEpoch();
    error ZeroPrice();

    constructor(
        uint256 initialAliceBalance
    ) {
        aliceBalance = initialAliceBalance;
    }

    function settleEpoch(
        uint256 epochId,
        uint256 equilibriumPrice
    ) external {
        if (epochId == 0) revert ZeroEpoch();
        if (equilibriumPrice == 0) revert ZeroPrice();

        Epoch storage epoch = epochs[epochId];
        if (!epoch.settled) {
            epoch.equilibriumPrice = equilibriumPrice;
            epoch.settled = true;
            epoch.settledAt = block.timestamp;
            epoch.aliceFill = ALICE_FILL;
            aliceBalance += ALICE_FILL;
        }

        emit EpochSettled(epochId, epoch.equilibriumPrice, aliceBalance);
    }

    function getEpoch(
        uint256 epochId
    ) external view returns (bool settled, uint256 equilibriumPrice, uint256 aliceTokens) {
        Epoch storage epoch = epochs[epochId];
        return (epoch.settled, epoch.equilibriumPrice, aliceBalance);
    }
}
