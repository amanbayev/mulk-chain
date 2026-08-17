// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IdentityRegistry} from "../src/identity/IdentityRegistry.sol";
import {GovOracle} from "../src/oracle/GovOracle.sol";
import {MulkToken} from "../src/token/MulkToken.sol";
import {EnforcementController} from "../src/governance/EnforcementController.sol";

/// @notice Local Anvil / testnet deploy of the Mülk Chain ERC-3643 stack.
///         Writes addresses to `packages/core-backend/src/config/addresses.json`
///         for ABI merge by `scripts/deploy-local.mjs`.
contract DeployMulkChain is Script {
    string public constant CADASTRE_NUMBER = "KZ-AST-2026-TOWER-01";

    function run() external {
        uint256 deployerKey = vm.envOr(
            "ANVIL_PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
        );
        address deployer = vm.addr(deployerKey);

        address oracleSigner = vm.envOr("ORACLE_SIGNER", address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8));
        address legal = vm.envOr("ENFORCEMENT_LEGAL", address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC));
        address compliance = vm.envOr("ENFORCEMENT_COMPLIANCE", address(0x90F79bf6EB2c4f870365E785982E1f101E93b906));
        address security = vm.envOr("ENFORCEMENT_SECURITY", address(0x15d34AAf54267DB15019cffFbC44fF54D3b8828C));
        address trustee = vm.envOr("ENFORCEMENT_TRUSTEE", address(0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc));
        address operations = vm.envOr("ENFORCEMENT_OPERATIONS", address(0x976EA74026E726554dB657fA54763abd0C3a0aa9));

        bytes32 cadastreHash = keccak256(bytes(CADASTRE_NUMBER));

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

        vm.stopBroadcast();

        console2.log("=== Mulk Chain deploy ===");
        console2.log("cadastre          ", CADASTRE_NUMBER);
        console2.log("cadastreHash      ", vm.toString(cadastreHash));
        console2.log("deployer          ", deployer);
        console2.log("oracleSigner      ", oracleSigner);
        console2.log("IdentityRegistry  ", address(identity));
        console2.log("GovOracle         ", address(oracle));
        console2.log("MulkToken         ", address(token));
        console2.log("Enforcement       ", address(enforcement));
        console2.log("Legal             ", legal);
        console2.log("Compliance        ", compliance);
        console2.log("Security          ", security);
        console2.log("Trustee           ", trustee);
        console2.log("Operations        ", operations);

        string memory root = "root";
        vm.serializeString(root, "network", "anvil");
        vm.serializeUint(root, "chainId", 31337);
        vm.serializeString(root, "cadastreNumber", CADASTRE_NUMBER);
        vm.serializeString(root, "cadastreHash", vm.toString(cadastreHash));
        vm.serializeAddress(root, "deployer", deployer);
        vm.serializeAddress(root, "oracleSigner", oracleSigner);
        vm.serializeAddress(root, "IdentityRegistry", address(identity));
        vm.serializeAddress(root, "GovOracle", address(oracle));
        vm.serializeAddress(root, "MulkToken", address(token));
        string memory rootJson = vm.serializeAddress(root, "EnforcementController", address(enforcement));

        string memory path = "packages/core-backend/src/config/addresses.json";
        vm.writeJson(rootJson, path);

        string memory enf = "enforcement";
        vm.serializeAddress(enf, "legal", legal);
        vm.serializeAddress(enf, "compliance", compliance);
        vm.serializeAddress(enf, "security", security);
        vm.serializeAddress(enf, "trustee", trustee);
        string memory enfJson = vm.serializeAddress(enf, "operations", operations);
        vm.writeJson(enfJson, path, ".enforcement");
        console2.log("wrote packages/core-backend/src/config/addresses.json");
    }
}
