// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IIdentityRegistry} from "../interfaces/IIdentityRegistry.sol";
import {IGovOracle} from "../interfaces/IGovOracle.sol";
import {IMulkEnforcementTarget} from "../interfaces/IMulkEnforcementTarget.sol";

/// @title MulkToken
/// @notice ERC-3643 / T-REX security token for AIFC-tokenized commercial real estate.
///         Emission is bound to an EGKN cadastral proof; transfers require OnchainID
///         verification on both legs; recovery and court-ordered moves are explicit.
contract MulkToken is ERC20, EIP712, Pausable, ReentrancyGuard, Ownable, IMulkEnforcementTarget {
    bytes32 public constant MINT_AUTH_TYPEHASH = keccak256(
        "MintAuthorization(address to,uint256 amount,bytes32 cadastreHash,uint256 nonce,uint256 deadline)"
    );

    IIdentityRegistry public identityRegistry;
    IGovOracle public govOracle;
    address public enforcementController;
    address public oracleSigner;

    mapping(address => bool) public agents;
    mapping(address => bool) public frozen;
    mapping(address => uint256) public frozenTokens;
    mapping(uint256 => bool) public usedNonces;
    mapping(bytes32 => uint256) public cadastreMinted;

    uint256 private _bypassCompliance;

    event AgentStatusSet(address indexed agent, bool authorized);
    event IdentityRegistrySet(address indexed registry);
    event GovOracleSet(address indexed oracle);
    event OracleSignerSet(address indexed signer);
    event EnforcementControllerSet(address indexed controller);
    event AddressFrozen(address indexed account, bool isFrozen);
    event TokensFrozen(address indexed account, uint256 amount);
    event VerifiedMint(address indexed to, uint256 amount, bytes32 indexed cadastreHash, uint256 nonce);
    event RecoveryCompleted(
        address indexed lostWallet, address indexed newWallet, address indexed investorOnchainID, uint256 amount
    );
    event ForcedTransfer(address indexed from, address indexed to, uint256 amount, address indexed operator);

    error NotAgent(address caller);
    error NotEnforcement(address caller);
    error ZeroAddress();
    error ZeroAmount();
    error NotVerified(address account);
    error IdentityMismatch(address wallet, address expectedOnchainID);
    error SameWallet();
    error ProofExpired(uint256 deadline);
    error NonceUsed(uint256 nonce);
    error InvalidCadastreHash();
    error CadastreProofRejected(bytes32 cadastreHash);
    error InvalidOracleSignature();
    error TransferInvalid(address from, address to, uint256 amount);
    error InsufficientAvailable(address account, uint256 required, uint256 available);
    error FrozenRecipient(address account);

    modifier onlyAgent() {
        if (!agents[msg.sender] && msg.sender != owner()) revert NotAgent(msg.sender);
        _;
    }

    modifier onlyEnforcement() {
        if (msg.sender != enforcementController) revert NotEnforcement(msg.sender);
        _;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner,
        address identityRegistry_,
        address govOracle_,
        address oracleSigner_
    ) ERC20(name_, symbol_) EIP712("MulkToken", "1") Ownable(initialOwner) {
        if (
            initialOwner == address(0) || identityRegistry_ == address(0) || govOracle_ == address(0)
                || oracleSigner_ == address(0)
        ) {
            revert ZeroAddress();
        }
        identityRegistry = IIdentityRegistry(identityRegistry_);
        govOracle = IGovOracle(govOracle_);
        oracleSigner = oracleSigner_;
        agents[initialOwner] = true;
        emit IdentityRegistrySet(identityRegistry_);
        emit GovOracleSet(govOracle_);
        emit OracleSignerSet(oracleSigner_);
        emit AgentStatusSet(initialOwner, true);
    }

    function setAgent(address agent, bool authorized) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        agents[agent] = authorized;
        emit AgentStatusSet(agent, authorized);
    }

    function setIdentityRegistry(address registry) external onlyOwner {
        if (registry == address(0)) revert ZeroAddress();
        identityRegistry = IIdentityRegistry(registry);
        emit IdentityRegistrySet(registry);
    }

    function setGovOracle(address oracle) external onlyOwner {
        if (oracle == address(0)) revert ZeroAddress();
        govOracle = IGovOracle(oracle);
        emit GovOracleSet(oracle);
    }

    function setOracleSigner(address signer) external onlyOwner {
        if (signer == address(0)) revert ZeroAddress();
        oracleSigner = signer;
        emit OracleSignerSet(signer);
    }

    function setEnforcementController(address controller) external onlyOwner {
        if (controller == address(0)) revert ZeroAddress();
        enforcementController = controller;
        emit EnforcementControllerSet(controller);
    }

    function setAddressFrozen(address account, bool isFrozen) external onlyAgent {
        if (account == address(0)) revert ZeroAddress();
        frozen[account] = isFrozen;
        emit AddressFrozen(account, isFrozen);
    }

    function freezePartialTokens(address account, uint256 amount) external onlyAgent {
        if (account == address(0)) revert ZeroAddress();
        frozenTokens[account] = amount;
        emit TokensFrozen(account, amount);
    }

    function pause() external onlyEnforcement {
        _pause();
    }

    function unpause() external onlyEnforcement {
        _unpause();
    }

    /// @notice EIP-712 digest signed by the isolated Gov-Oracle key for `verifiedMint`.
    function hashMintAuthorization(
        address to,
        uint256 amount,
        bytes32 cadastreHash,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(abi.encode(MINT_AUTH_TYPEHASH, to, amount, cadastreHash, nonce, deadline))
        );
    }

    function availableBalance(address account) public view returns (uint256) {
        if (frozen[account]) return 0;
        uint256 bal = balanceOf(account);
        uint256 locked = frozenTokens[account];
        return bal > locked ? bal - locked : 0;
    }

    /// @notice ERC-3643 transfer gate: KYC both legs, freeze, pause, available balance.
    function validateTransfer(address from, address to, uint256 amount) public view returns (bool) {
        if (paused()) return false;
        if (from == address(0) || to == address(0)) return false;
        if (amount == 0) return false;
        if (frozen[from] || frozen[to]) return false;
        if (!identityRegistry.isVerified(from) || !identityRegistry.isVerified(to)) return false;
        if (availableBalance(from) < amount) return false;
        return true;
    }

    /// @notice Mints only with a live EGKN cadastral proof and oracle EIP-712 signature.
    function verifiedMint(address to, uint256 amount, bytes calldata proof) external onlyAgent whenNotPaused nonReentrant {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!identityRegistry.isVerified(to)) revert NotVerified(to);

        (bytes32 cadastreHash, uint256 nonce, uint256 deadline, bytes memory signature) =
            abi.decode(proof, (bytes32, uint256, uint256, bytes));

        if (cadastreHash == bytes32(0)) revert InvalidCadastreHash();
        if (block.timestamp > deadline) revert ProofExpired(deadline);
        if (usedNonces[nonce]) revert NonceUsed(nonce);
        if (!govOracle.verifyCadastreProof(cadastreHash, proof)) revert CadastreProofRejected(cadastreHash);

        address recovered = ECDSA.recover(hashMintAuthorization(to, amount, cadastreHash, nonce, deadline), signature);
        if (recovered != oracleSigner) revert InvalidOracleSignature();

        usedNonces[nonce] = true;
        cadastreMinted[cadastreHash] += amount;
        _mint(to, amount);
        emit VerifiedMint(to, amount, cadastreHash, nonce);
    }

    /// @notice Inheritance / lost-key recovery: freeze lost wallet, move balance to a
    ///         newly verified wallet bound to the same OnchainID.
    function recoveryAddress(address lostWallet, address newWallet, address investorOnchainID)
        external
        onlyAgent
        whenNotPaused
        nonReentrant
    {
        if (lostWallet == address(0) || newWallet == address(0) || investorOnchainID == address(0)) {
            revert ZeroAddress();
        }
        if (lostWallet == newWallet) revert SameWallet();
        if (identityRegistry.investorOnchainID(lostWallet) != investorOnchainID) {
            revert IdentityMismatch(lostWallet, investorOnchainID);
        }
        if (identityRegistry.investorOnchainID(newWallet) != investorOnchainID) {
            revert IdentityMismatch(newWallet, investorOnchainID);
        }
        if (!identityRegistry.isVerified(newWallet)) revert NotVerified(newWallet);

        frozen[lostWallet] = true;
        emit AddressFrozen(lostWallet, true);

        uint256 amount = balanceOf(lostWallet);
        if (amount > 0) {
            frozenTokens[lostWallet] = 0;
            _bypassCompliance = 1;
            _transfer(lostWallet, newWallet, amount);
            _bypassCompliance = 0;
        }

        emit RecoveryCompleted(lostWallet, newWallet, investorOnchainID, amount);
    }

    /// @notice Court-ordered transfer. Callable only by the 3-of-5 EnforcementController.
    function forcedTransfer(address from, address to, uint256 amount)
        external
        onlyEnforcement
        nonReentrant
        returns (bool)
    {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (!identityRegistry.isVerified(to)) revert NotVerified(to);
        if (frozen[to]) revert FrozenRecipient(to);
        uint256 bal = balanceOf(from);
        if (bal < amount) revert InsufficientAvailable(from, amount, bal);

        uint256 locked = frozenTokens[from];
        if (locked > bal - amount) {
            frozenTokens[from] = bal - amount;
        }

        _bypassCompliance = 1;
        _transfer(from, to, amount);
        _bypassCompliance = 0;
        emit ForcedTransfer(from, to, amount, msg.sender);
        return true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (_bypassCompliance == 0 && from != address(0) && to != address(0)) {
            if (!validateTransfer(from, to, value)) revert TransferInvalid(from, to, value);
        }
        super._update(from, to, value);
    }
}
