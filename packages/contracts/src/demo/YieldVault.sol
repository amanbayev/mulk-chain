// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

/// @title YieldVault
/// @notice Demo ERC-3643 dividend claim surface for the investor payouts console.
///         Credits the seeded Alice wallet regardless of `msg.sender` so the demo
///         button can be driven from Anvil's unlocked deployer account.
contract YieldVault {
    uint256 public constant CLAIM_AMOUNT = 450_000000;

    address public immutable alice;
    mapping(string => mapping(address => uint256)) public claimable;
    mapping(address => uint256) public walletBalance;

    event DividendsClaimed(string assetId, address indexed investor, uint256 amount, uint256 walletBalance);

    error EmptyAssetId();
    error NothingToClaim(string assetId);

    constructor(
        address alice_
    ) {
        alice = alice_;
        claimable["BAITEREK-BC"][alice_] = CLAIM_AMOUNT;
    }

    function claimDividends(
        string calldata assetId
    ) external {
        if (bytes(assetId).length == 0) revert EmptyAssetId();
        uint256 amount = claimable[assetId][alice];
        if (amount == 0) revert NothingToClaim(assetId);
        claimable[assetId][alice] = 0;
        walletBalance[alice] += amount;
        emit DividendsClaimed(assetId, alice, amount, walletBalance[alice]);
    }

    function claimableOf(
        string calldata assetId
    ) external view returns (uint256) {
        return claimable[assetId][alice];
    }

    function aliceWalletUsdt() external view returns (uint256) {
        return walletBalance[alice];
    }
}
