// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {MulkToken} from "../src/token/MulkToken.sol";
import {EnforcementController} from "../src/governance/EnforcementController.sol";
import {IdentityRegistry} from "../src/identity/IdentityRegistry.sol";
import {GovOracle} from "../src/oracle/GovOracle.sol";

contract MulkTokenTest is Test {
    IdentityRegistry internal identity;
    GovOracle internal oracle;
    MulkToken internal token;
    EnforcementController internal enforcement;

    address internal owner;
    address internal alice;
    address internal bob;
    address internal charlie;
    address internal aliceOnchainID;
    address internal bobOnchainID;

    address internal oracleSigner;
    uint256 internal oraclePk;

    address internal legal;
    address internal compliance;
    address internal security;
    address internal trustee;
    address internal operations;

    bytes32 internal constant CADASTRE_HASH = keccak256("EGKN:KZ-75-123-456-789");
    uint256 internal constant MINT_AMOUNT = 1_000 ether;

    function setUp() public {
        owner = makeAddr("owner");
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        charlie = makeAddr("charlie");
        aliceOnchainID = makeAddr("aliceOnchainID");
        bobOnchainID = makeAddr("bobOnchainID");

        (oracleSigner, oraclePk) = makeAddrAndKey("govOracleSigner");

        legal = makeAddr("legal");
        compliance = makeAddr("compliance");
        security = makeAddr("security");
        trustee = makeAddr("trustee");
        operations = makeAddr("operations");

        vm.startPrank(owner);
        identity = new IdentityRegistry(owner);
        oracle = new GovOracle(owner);
        token = new MulkToken(unicode"Mülk Tower Share", "MULK", owner, address(identity), address(oracle), oracleSigner);

        address[5] memory signers = [legal, compliance, security, trustee, operations];
        enforcement = new EnforcementController(address(token), signers);
        token.setEnforcementController(address(enforcement));

        identity.registerIdentity(alice, aliceOnchainID);
        identity.registerIdentity(bob, bobOnchainID);
        vm.stopPrank();
    }

    function _mintProof(address to, uint256 amount, bytes32 cadastreHash, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes memory proof)
    {
        bytes32 digest = token.hashMintAuthorization(to, amount, cadastreHash, nonce, deadline);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, digest);
        bytes memory signature = abi.encodePacked(r, s, v);
        proof = abi.encode(cadastreHash, nonce, deadline, signature);
    }

    function _verifiedMint(address to, uint256 amount) internal {
        uint256 nonce = 1;
        uint256 deadline = block.timestamp + 1 days;
        bytes memory proof = _mintProof(to, amount, CADASTRE_HASH, nonce, deadline);
        vm.prank(owner);
        token.verifiedMint(to, amount, proof);
    }

    // -------------------------------------------------------------------------
    // 1. verifiedMint — valid oracle signature only
    // -------------------------------------------------------------------------

    function test_VerifiedMint_SucceedsWithValidOracleSignature() public {
        uint256 nonce = 42;
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory proof = _mintProof(alice, MINT_AMOUNT, CADASTRE_HASH, nonce, deadline);

        vm.prank(owner);
        token.verifiedMint(alice, MINT_AMOUNT, proof);

        assertEq(token.balanceOf(alice), MINT_AMOUNT);
        assertEq(token.cadastreMinted(CADASTRE_HASH), MINT_AMOUNT);
        assertTrue(token.usedNonces(nonce));
    }

    function test_VerifiedMint_RevertsWithInvalidOracleSignature() public {
        uint256 nonce = 7;
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 digest = token.hashMintAuthorization(alice, MINT_AMOUNT, CADASTRE_HASH, nonce, deadline);
        (, uint256 attackerPk) = makeAddrAndKey("attacker");
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(attackerPk, digest);
        bytes memory proof = abi.encode(CADASTRE_HASH, nonce, deadline, abi.encodePacked(r, s, v));

        vm.prank(owner);
        vm.expectRevert(MulkToken.InvalidOracleSignature.selector);
        token.verifiedMint(alice, MINT_AMOUNT, proof);
    }

    function test_VerifiedMint_RevertsWhenCadastreEncumbered() public {
        vm.prank(owner);
        oracle.setEncumbrance(CADASTRE_HASH, true);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory proof = _mintProof(alice, MINT_AMOUNT, CADASTRE_HASH, 1, deadline);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.CadastreProofRejected.selector, CADASTRE_HASH));
        token.verifiedMint(alice, MINT_AMOUNT, proof);
    }

    function test_VerifiedMint_RevertsForUnverifiedRecipient() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory proof = _mintProof(charlie, MINT_AMOUNT, CADASTRE_HASH, 1, deadline);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.NotVerified.selector, charlie));
        token.verifiedMint(charlie, MINT_AMOUNT, proof);
    }

    function test_VerifiedMint_RevertsOnReplayNonce() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory proof = _mintProof(alice, MINT_AMOUNT, CADASTRE_HASH, 99, deadline);

        vm.startPrank(owner);
        token.verifiedMint(alice, MINT_AMOUNT, proof);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.NonceUsed.selector, uint256(99)));
        token.verifiedMint(alice, MINT_AMOUNT, proof);
        vm.stopPrank();
    }

    function test_VerifiedMint_RevertsWhenExpired() public {
        uint256 deadline = block.timestamp + 10;
        bytes memory proof = _mintProof(alice, MINT_AMOUNT, CADASTRE_HASH, 1, deadline);
        vm.warp(deadline + 1);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.ProofExpired.selector, deadline));
        token.verifiedMint(alice, MINT_AMOUNT, proof);
    }

    // -------------------------------------------------------------------------
    // 2. Transfers blocked to non-custodial wallets without KYC / OnchainID
    // -------------------------------------------------------------------------

    function test_Transfer_RevertsToUnverifiedAddress() public {
        _verifiedMint(alice, MINT_AMOUNT);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.TransferInvalid.selector, alice, charlie, uint256(1 ether)));
        token.transfer(charlie, 1 ether);
    }

    function test_Transfer_SucceedsBetweenVerifiedInvestors() public {
        _verifiedMint(alice, MINT_AMOUNT);

        vm.prank(alice);
        bool ok = token.transfer(bob, 100 ether);
        assertTrue(ok);
        assertEq(token.balanceOf(alice), MINT_AMOUNT - 100 ether);
        assertEq(token.balanceOf(bob), 100 ether);
    }

    function test_Transfer_RevertsFromFrozenSender() public {
        _verifiedMint(alice, MINT_AMOUNT);
        vm.prank(owner);
        token.setAddressFrozen(alice, true);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.TransferInvalid.selector, alice, bob, uint256(1 ether)));
        token.transfer(bob, 1 ether);
    }

    function test_Transfer_RevertsWhenPartialFreezeExceedsAvailable() public {
        _verifiedMint(alice, MINT_AMOUNT);
        vm.prank(owner);
        token.freezePartialTokens(alice, MINT_AMOUNT - 10 ether);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MulkToken.TransferInvalid.selector, alice, bob, uint256(11 ether))
        );
        token.transfer(bob, 11 ether);

        vm.prank(alice);
        assertTrue(token.transfer(bob, 10 ether));
    }

    function test_ValidateTransfer_FalseForUnverifiedCounterparty() public {
        _verifiedMint(alice, MINT_AMOUNT);
        assertFalse(token.validateTransfer(alice, charlie, 1 ether));
        assertTrue(token.validateTransfer(alice, bob, 1 ether));
    }

    // -------------------------------------------------------------------------
    // 3. recoveryAddress — freeze lost wallet and move tokens
    // -------------------------------------------------------------------------

    function test_RecoveryAddress_FreezesLostWalletAndMovesTokens() public {
        address aliceNew = makeAddr("aliceNew");
        vm.prank(owner);
        identity.bindWallet(aliceNew, aliceOnchainID, true);

        _verifiedMint(alice, MINT_AMOUNT);

        vm.prank(owner);
        token.recoveryAddress(alice, aliceNew, aliceOnchainID);

        assertTrue(token.frozen(alice));
        assertEq(token.balanceOf(alice), 0);
        assertEq(token.balanceOf(aliceNew), MINT_AMOUNT);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.TransferInvalid.selector, alice, bob, uint256(1 ether)));
        token.transfer(bob, 1 ether);

        vm.prank(aliceNew);
        assertTrue(token.transfer(bob, 5 ether));
        assertEq(token.balanceOf(bob), 5 ether);
    }

    function test_RecoveryAddress_RevertsOnIdentityMismatch() public {
        _verifiedMint(alice, MINT_AMOUNT);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.IdentityMismatch.selector, bob, aliceOnchainID));
        token.recoveryAddress(alice, bob, aliceOnchainID);
    }

    function test_RecoveryAddress_RevertsIfNewWalletNotVerified() public {
        address aliceNew = makeAddr("aliceNewUnverified");
        vm.prank(owner);
        identity.bindWallet(aliceNew, aliceOnchainID, false);

        _verifiedMint(alice, MINT_AMOUNT);

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.NotVerified.selector, aliceNew));
        token.recoveryAddress(alice, aliceNew, aliceOnchainID);
    }

    // -------------------------------------------------------------------------
    // 4. forcedTransfer via 3-of-5 EnforcementController
    // -------------------------------------------------------------------------

    function test_ForcedTransfer_RevertsIfCalledByEOA() public {
        _verifiedMint(alice, MINT_AMOUNT);

        vm.prank(legal);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.NotEnforcement.selector, legal));
        token.forcedTransfer(alice, bob, 10 ether);
    }

    function test_ForcedTransfer_RevertsBelowMultisigThreshold() public {
        _verifiedMint(alice, MINT_AMOUNT);
        bytes32 caseRef = keccak256("AIFC-COURT-2026-001");

        vm.prank(legal);
        uint256 proposalId = enforcement.proposeForcedTransfer(alice, bob, 250 ether, caseRef);

        vm.prank(compliance);
        enforcement.confirm(proposalId);

        vm.prank(security);
        vm.expectRevert(
            abi.encodeWithSelector(EnforcementController.ThresholdNotMet.selector, proposalId, uint256(2), uint256(3))
        );
        enforcement.execute(proposalId);

        assertEq(token.balanceOf(alice), MINT_AMOUNT);
        assertEq(token.balanceOf(bob), 0);
    }

    function test_ForcedTransfer_SucceedsViaEnforcementMultisig() public {
        _verifiedMint(alice, MINT_AMOUNT);
        vm.prank(owner);
        token.setAddressFrozen(alice, true);

        bytes32 caseRef = keccak256("AIFC-COURT-2026-001");
        uint256 seized = 400 ether;

        vm.prank(legal);
        uint256 proposalId = enforcement.proposeForcedTransfer(alice, bob, seized, caseRef);

        vm.prank(compliance);
        enforcement.confirm(proposalId);

        vm.prank(trustee);
        enforcement.confirm(proposalId);

        vm.prank(operations);
        enforcement.execute(proposalId);

        assertEq(token.balanceOf(alice), MINT_AMOUNT - seized);
        assertEq(token.balanceOf(bob), seized);
        assertTrue(token.frozen(alice));

        EnforcementController.Proposal memory proposal = enforcement.getProposal(proposalId);
        assertTrue(proposal.executed);
        assertEq(proposal.confirmationCount, 3);
        assertEq(proposal.caseRef, caseRef);
    }

    function test_ForcedTransfer_CannotExecuteTwice() public {
        _verifiedMint(alice, MINT_AMOUNT);
        bytes32 caseRef = keccak256("AIFC-COURT-2026-002");

        vm.prank(legal);
        uint256 proposalId = enforcement.proposeForcedTransfer(alice, bob, 1 ether, caseRef);
        vm.prank(compliance);
        enforcement.confirm(proposalId);
        vm.prank(security);
        enforcement.confirm(proposalId);
        vm.prank(trustee);
        enforcement.execute(proposalId);

        vm.prank(operations);
        vm.expectRevert(abi.encodeWithSelector(EnforcementController.AlreadyExecuted.selector, proposalId));
        enforcement.execute(proposalId);
    }

    function test_Pause_ViaEnforcementMultisigBlocksMintAndTransfer() public {
        _verifiedMint(alice, MINT_AMOUNT);
        bytes32 caseRef = keccak256("INCIDENT-PAUSE-1");

        vm.prank(security);
        uint256 proposalId = enforcement.proposePause(caseRef);
        vm.prank(legal);
        enforcement.confirm(proposalId);
        vm.prank(compliance);
        enforcement.confirm(proposalId);
        vm.prank(operations);
        enforcement.execute(proposalId);

        assertTrue(token.paused());

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(MulkToken.TransferInvalid.selector, alice, bob, uint256(1 ether)));
        token.transfer(bob, 1 ether);
    }
}
