// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";

/// @title IdentityRegistry
/// @notice Minimal OnchainID registry: wallet → identity binding + verification flag.
contract IdentityRegistry is IIdentityRegistry, Ownable {
    mapping(address => address) private _onchainIDs;
    mapping(address => bool) private _verified;
    mapping(address => bool) public agents;

    event AgentStatusSet(address indexed agent, bool authorized);
    event IdentityRegistered(address indexed investor, address indexed onchainID);
    event IdentityRemoved(address indexed investor);
    event VerificationUpdated(address indexed investor, bool verified);

    error NotAgent(address caller);
    error ZeroAddress();

    modifier onlyAgent() {
        if (!agents[msg.sender] && msg.sender != owner()) revert NotAgent(msg.sender);
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        agents[initialOwner] = true;
        emit AgentStatusSet(initialOwner, true);
    }

    function setAgent(address agent, bool authorized) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        agents[agent] = authorized;
        emit AgentStatusSet(agent, authorized);
    }

    function registerIdentity(address investor, address onchainID) external onlyAgent {
        if (investor == address(0) || onchainID == address(0)) revert ZeroAddress();
        _onchainIDs[investor] = onchainID;
        _verified[investor] = true;
        emit IdentityRegistered(investor, onchainID);
        emit VerificationUpdated(investor, true);
    }

    /// @notice Binds a second wallet to an existing OnchainID (recovery / inheritance).
    function bindWallet(address wallet, address onchainID, bool verified) external onlyAgent {
        if (wallet == address(0) || onchainID == address(0)) revert ZeroAddress();
        _onchainIDs[wallet] = onchainID;
        _verified[wallet] = verified;
        emit IdentityRegistered(wallet, onchainID);
        emit VerificationUpdated(wallet, verified);
    }

    function removeIdentity(address investor) external onlyAgent {
        delete _onchainIDs[investor];
        _verified[investor] = false;
        emit IdentityRemoved(investor);
        emit VerificationUpdated(investor, false);
    }

    function setVerified(address investor, bool verified) external onlyAgent {
        if (_onchainIDs[investor] == address(0)) revert ZeroAddress();
        _verified[investor] = verified;
        emit VerificationUpdated(investor, verified);
    }

    function isVerified(address investor) external view returns (bool) {
        return _verified[investor] && _onchainIDs[investor] != address(0);
    }

    function investorOnchainID(address investor) external view returns (address) {
        return _onchainIDs[investor];
    }
}
