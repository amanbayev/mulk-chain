// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {IMulkEnforcementTarget} from "../interfaces/IMulkEnforcementTarget.sol";

/// @title EnforcementController
/// @notice 3-of-5 multisig over court-ordered `forcedTransfer` and emergency pause.
///         Signers: Legal, Compliance, Security, Trustee, Operations — distinct officers.
contract EnforcementController {
    uint256 public constant THRESHOLD = 3;
    uint256 public constant SIGNER_COUNT = 5;

    enum Role {
        Legal,
        Compliance,
        Security,
        Trustee,
        Operations
    }

    enum ActionType {
        ForcedTransfer,
        Pause,
        Unpause
    }

    struct Proposal {
        ActionType actionType;
        address from;
        address to;
        uint256 amount;
        bytes32 caseRef;
        uint256 confirmationCount;
        bool executed;
        bool cancelled;
        uint256 createdAt;
    }

    IMulkEnforcementTarget public immutable token;
    address[5] public signers;
    mapping(address => bool) public isSigner;
    mapping(address => Role) public roleOf;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) private _proposals;
    mapping(uint256 => mapping(address => bool)) public confirmed;

    event ProposalCreated(
        uint256 indexed proposalId,
        ActionType actionType,
        address indexed proposer,
        address from,
        address to,
        uint256 amount,
        bytes32 caseRef
    );
    event ProposalConfirmed(uint256 indexed proposalId, address indexed signer, Role role, uint256 confirmationCount);
    event ProposalExecuted(uint256 indexed proposalId, ActionType actionType);
    event ProposalCancelled(uint256 indexed proposalId, address indexed signer);

    error InvalidSignerSet();
    error DuplicateSigner(address signer);
    error ZeroAddress();
    error ZeroAmount();
    error EmptyCaseRef();
    error NotSigner(address caller);
    error UnknownProposal(uint256 proposalId);
    error AlreadyConfirmed(uint256 proposalId, address signer);
    error AlreadyExecuted(uint256 proposalId);
    error ProposalIsCancelled(uint256 proposalId);
    error ThresholdNotMet(uint256 proposalId, uint256 have, uint256 need);

    modifier onlySigner() {
        if (!isSigner[msg.sender]) revert NotSigner(msg.sender);
        _;
    }

    constructor(address token_, address[5] memory signers_) {
        if (token_ == address(0)) revert ZeroAddress();
        token = IMulkEnforcementTarget(token_);

        for (uint256 i = 0; i < SIGNER_COUNT; i++) {
            address signer = signers_[i];
            if (signer == address(0)) revert InvalidSignerSet();
            if (isSigner[signer]) revert DuplicateSigner(signer);
            isSigner[signer] = true;
            signers[i] = signer;
            roleOf[signer] = Role(i);
        }
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId == 0 || proposalId > proposalCount) revert UnknownProposal(proposalId);
        return _proposals[proposalId];
    }

    function proposeForcedTransfer(address from, address to, uint256 amount, bytes32 caseRef)
        external
        onlySigner
        returns (uint256 proposalId)
    {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (caseRef == bytes32(0)) revert EmptyCaseRef();
        proposalId = _create(ActionType.ForcedTransfer, from, to, amount, caseRef);
    }

    function proposePause(bytes32 caseRef) external onlySigner returns (uint256 proposalId) {
        if (caseRef == bytes32(0)) revert EmptyCaseRef();
        proposalId = _create(ActionType.Pause, address(0), address(0), 0, caseRef);
    }

    function proposeUnpause(bytes32 caseRef) external onlySigner returns (uint256 proposalId) {
        if (caseRef == bytes32(0)) revert EmptyCaseRef();
        proposalId = _create(ActionType.Unpause, address(0), address(0), 0, caseRef);
    }

    function confirm(uint256 proposalId) external onlySigner {
        Proposal storage proposal = _requireActive(proposalId);
        if (confirmed[proposalId][msg.sender]) revert AlreadyConfirmed(proposalId, msg.sender);
        confirmed[proposalId][msg.sender] = true;
        proposal.confirmationCount += 1;
        emit ProposalConfirmed(proposalId, msg.sender, roleOf[msg.sender], proposal.confirmationCount);
    }

    function execute(uint256 proposalId) external onlySigner {
        Proposal storage proposal = _requireActive(proposalId);
        if (proposal.confirmationCount < THRESHOLD) {
            revert ThresholdNotMet(proposalId, proposal.confirmationCount, THRESHOLD);
        }
        proposal.executed = true;

        if (proposal.actionType == ActionType.ForcedTransfer) {
            token.forcedTransfer(proposal.from, proposal.to, proposal.amount);
        } else if (proposal.actionType == ActionType.Pause) {
            token.pause();
        } else {
            token.unpause();
        }

        emit ProposalExecuted(proposalId, proposal.actionType);
    }

    function cancel(uint256 proposalId) external onlySigner {
        Proposal storage proposal = _requireActive(proposalId);
        proposal.cancelled = true;
        emit ProposalCancelled(proposalId, msg.sender);
    }

    function _create(ActionType actionType, address from, address to, uint256 amount, bytes32 caseRef)
        private
        returns (uint256 proposalId)
    {
        proposalId = ++proposalCount;
        Proposal storage proposal = _proposals[proposalId];
        proposal.actionType = actionType;
        proposal.from = from;
        proposal.to = to;
        proposal.amount = amount;
        proposal.caseRef = caseRef;
        proposal.createdAt = block.timestamp;

        confirmed[proposalId][msg.sender] = true;
        proposal.confirmationCount = 1;

        emit ProposalCreated(proposalId, actionType, msg.sender, from, to, amount, caseRef);
        emit ProposalConfirmed(proposalId, msg.sender, roleOf[msg.sender], 1);
    }

    function _requireActive(uint256 proposalId) private view returns (Proposal storage proposal) {
        if (proposalId == 0 || proposalId > proposalCount) revert UnknownProposal(proposalId);
        proposal = _proposals[proposalId];
        if (proposal.executed) revert AlreadyExecuted(proposalId);
        if (proposal.cancelled) revert ProposalIsCancelled(proposalId);
    }
}
