// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/identity/IdentityRegistry.sol";
import {GovOracle} from "../src/oracle/GovOracle.sol";
import {MulkToken} from "../src/token/MulkToken.sol";
import {EnforcementController} from "../src/governance/EnforcementController.sol";
import {GovOracleBridge} from "../src/demo/GovOracleBridge.sol";
import {BatchAuctionEngine} from "../src/demo/BatchAuctionEngine.sol";
import {YieldVault} from "../src/demo/YieldVault.sol";

/// @notice Local Anvil / testnet deploy of the Mulk Chain ERC-3643 stack.
///         Writes addresses to `packages/core-backend/src/config/addresses.json`
///         for ABI merge by `scripts/deploy-local.mjs`.
///         Locals live on storage so solc 0.8.24 compiles without via-IR.
contract DeployMulkChain is Script {
    string public constant CADASTRE_NUMBER = "KZ-AST-2026-TOWER-01";
    string internal constant ADDRESSES_PATH = "packages/core-backend/src/config/addresses.json";

    uint256 internal deployerKey;
    address internal deployer;
    address internal oracleSigner;
    address internal legal;
    address internal compliance;
    address internal security;
    address internal trustee;
    address internal operations;
    bytes32 internal cadastreHash;
    address internal identityAddr;
    address internal oracleAddr;
    address internal tokenAddr;
    address internal enforcementAddr;
    address internal bridgeAddr;
    address internal auctionAddr;
    address internal vaultAddr;
    address internal alice;

    function run() external {
        _load();
        _broadcast();
        _log();
        _writeRootJson();
        _writeEnforcementJson();
    }

    function _load() internal {
        deployerKey = _loadPrivateKey();
        deployer = vm.addr(deployerKey);
        oracleSigner = _loadAddress("ORACLE_SIGNER_ADDRESS", "ORACLE_SIGNER", deployer);
        legal = _loadAddress("GOV_MULTISIG_ADMIN_1", "ENFORCEMENT_LEGAL", address(0));
        compliance = _loadAddress("GOV_MULTISIG_ADMIN_2", "ENFORCEMENT_COMPLIANCE", address(0));
        security = _loadAddress("GOV_MULTISIG_ADMIN_3", "ENFORCEMENT_SECURITY", address(0));
        trustee = _loadAddress("GOV_MULTISIG_ADMIN_4", "ENFORCEMENT_TRUSTEE", address(0));
        operations = _loadAddress("GOV_MULTISIG_ADMIN_5", "ENFORCEMENT_OPERATIONS", address(0));
        alice = _loadAddress("DEMO_ALICE", "", deployer);
        cadastreHash = keccak256(bytes(CADASTRE_NUMBER));
        if (oracleSigner == address(0)) revert("DeployMulkChain: missing ORACLE_SIGNER_ADDRESS");
        if (legal == address(0) || compliance == address(0) || security == address(0)) {
            revert("DeployMulkChain: set GOV_MULTISIG_ADMIN_1..3");
        }
        if (trustee == address(0) || operations == address(0)) {
            revert("DeployMulkChain: set GOV_MULTISIG_ADMIN_4 and GOV_MULTISIG_ADMIN_5 (3-of-5)");
        }
    }

    function _loadPrivateKey() internal view returns (uint256) {
        if (vm.envExists("PRIVATE_KEY")) return vm.envUint("PRIVATE_KEY");
        if (vm.envExists("ANVIL_PRIVATE_KEY")) return vm.envUint("ANVIL_PRIVATE_KEY");
        revert("DeployMulkChain: set PRIVATE_KEY");
    }

    function _loadAddress(
        string memory primary,
        string memory aliasKey,
        address fallbackValue
    ) internal view returns (address) {
        if (vm.envExists(primary)) return vm.envAddress(primary);
        if (bytes(aliasKey).length != 0 && vm.envExists(aliasKey)) return vm.envAddress(aliasKey);
        return fallbackValue;
    }

    function _broadcast() internal {
        vm.startBroadcast(deployerKey);

        IdentityRegistry identity = new IdentityRegistry(deployer);
        GovOracle oracle = new GovOracle(deployer);
        oracle.setReporter(oracleSigner, true);

        MulkToken token = new MulkToken(
            "Baiterek Business Center", "MULK", deployer, address(identity), address(oracle), oracleSigner
        );

        address[5] memory signers = [legal, compliance, security, trustee, operations];
        EnforcementController enforcement = new EnforcementController(address(token), signers);
        token.setEnforcementController(address(enforcement));

        GovOracleBridge bridge = new GovOracleBridge();
        BatchAuctionEngine auction = new BatchAuctionEngine(1_250);
        YieldVault vault = new YieldVault(alice);
        _seedDocumentHashes(bridge);

        identityAddr = address(identity);
        oracleAddr = address(oracle);
        tokenAddr = address(token);
        enforcementAddr = address(enforcement);
        bridgeAddr = address(bridge);
        auctionAddr = address(auction);
        vaultAddr = address(vault);

        vm.stopBroadcast();
    }

    function _log() internal view {
        console2.log("=== Mulk Chain deploy ===");
        console2.log("cadastre          ", CADASTRE_NUMBER);
        console2.log("cadastreHash      ", vm.toString(cadastreHash));
        console2.log("deployer          ", deployer);
        console2.log("oracleSigner      ", oracleSigner);
        console2.log("IdentityRegistry  ", identityAddr);
        console2.log("GovOracle         ", oracleAddr);
        console2.log("MulkToken         ", tokenAddr);
        console2.log("Enforcement       ", enforcementAddr);
        console2.log("GovOracleBridge   ", bridgeAddr);
        console2.log("BatchAuction      ", auctionAddr);
        console2.log("YieldVault        ", vaultAddr);
        console2.log("Alice             ", alice);
        console2.log("Legal             ", legal);
        console2.log("Compliance        ", compliance);
        console2.log("Security          ", security);
        console2.log("Trustee           ", trustee);
        console2.log("Operations        ", operations);
    }

    function _writeRootJson() internal {
        uint256 chainId = block.chainid;
        string memory network = chainId == 421614 ? "arbitrum-sepolia" : (chainId == 31337 ? "anvil" : "evm");
        string memory root = "root";
        vm.serializeString(root, "network", network);
        vm.serializeUint(root, "chainId", chainId);
        vm.serializeString(root, "cadastreNumber", CADASTRE_NUMBER);
        vm.serializeString(root, "cadastreHash", vm.toString(cadastreHash));
        _writeRootAddresses(root);
    }

    function _writeRootAddresses(
        string memory root
    ) internal {
        vm.serializeAddress(root, "deployer", deployer);
        vm.serializeAddress(root, "oracleSigner", oracleSigner);
        vm.serializeAddress(root, "IdentityRegistry", identityAddr);
        vm.serializeAddress(root, "GovOracle", oracleAddr);
        vm.serializeAddress(root, "MulkToken", tokenAddr);
        vm.serializeAddress(root, "EnforcementController", enforcementAddr);
        vm.serializeAddress(root, "GovOracleBridge", bridgeAddr);
        vm.serializeAddress(root, "BatchAuctionEngine", auctionAddr);
        string memory rootJson = vm.serializeAddress(root, "YieldVault", vaultAddr);
        vm.writeJson(rootJson, ADDRESSES_PATH);
    }

    function _seedDocumentHashes(
        GovOracleBridge bridge
    ) internal {
        bridge.setDocumentHash(
            "BAITEREK-BC-CHARTER", bytes32(0xa7c31e9f4b8d2a1056e0c94f7d1b3a8e2c5f90d6b4a1e7c3f8d2b6a0e5c19f44)
        );
        bridge.setDocumentHash(
            "BAITEREK-BC-VALUATION", bytes32(0xc0b8d41a93e7f25610d4c8a9e2b7f3d1a6c0e85b4f29d7a3c1e6b0d48f5a27c9)
        );
        bridge.setDocumentHash(
            "BAITEREK-BC-DEED", bytes32(0xe15f90b2c7a4d8e36b1c0f9a5d2e7c4b8a0f3d16e9c2b5a7d4f0e8c1b3a695d2)
        );
        bridge.setDocumentHash(
            "BAITEREK-BC-SANDBOX", bytes32(0x9d2a6c4e1b8f0a735c9e2d4b6a1f8c0e3d5b7a92f4c1e6d0b8a3f5c7e19d2a60)
        );
    }

    function _writeEnforcementJson() internal {
        string memory enf = "enforcement";
        vm.serializeAddress(enf, "legal", legal);
        vm.serializeAddress(enf, "compliance", compliance);
        vm.serializeAddress(enf, "security", security);
        vm.serializeAddress(enf, "trustee", trustee);
        string memory enfJson = vm.serializeAddress(enf, "operations", operations);
        vm.writeJson(enfJson, ADDRESSES_PATH, ".enforcement");
        console2.log("wrote packages/core-backend/src/config/addresses.json");
    }
}
