import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Wallet, verifyTypedData } from "ethers";
import {
  CadastreService,
  CadastreOracleError,
  InMemorySmartBridge,
  eip712Domain,
  encodeMintProof,
  hashCadastralNumber,
  MINT_AUTH_TYPES,
} from "./cadastre.service.ts";

const CADASTRAL = "KZ-75-123-456-789";
const TOKEN = "0x0000000000000000000000000000000000003643";
const INVESTOR = "0x0000000000000000000000000000000000000A11";

function service(bridge: InMemorySmartBridge, wallet = Wallet.createRandom()) {
  return new CadastreService({
    chainId: 31337,
    verifyingContract: TOKEN,
    oracleWallet: wallet,
    smartBridge: bridge,
    bridgeTimeoutMs: 200,
    notarialWindowMs: 60_000,
  });
}

describe("CadastreService", () => {
  it("issues an EIP-712 mint proof only when EGKN reports CLEAR", async () => {
    const wallet = Wallet.createRandom();
    const bridge = new InMemorySmartBridge();
    const cadastreHash = hashCadastralNumber(CADASTRAL);
    bridge.seed({
      cadastralNumber: CADASTRAL,
      cadastreHash,
      objectName: "Almaty Business Center",
      encumbrance: "CLEAR",
      encumbranceRef: null,
      asOf: new Date(),
      source: "SMART_BRIDGE",
    });

    const oracle = service(bridge, wallet);
    const proof = await oracle.authorizeVerifiedMint({
      cadastralNumber: CADASTRAL,
      to: INVESTOR,
      amount: 1_000n * 10n ** 18n,
      nonce: 1n,
      deadline: 1_800_000_000n,
    });

    assert.equal(proof.cadastreHash, cadastreHash);
    assert.equal(proof.source, "SMART_BRIDGE");
    assert.match(proof.proof, /^0x/);
    assert.equal(proof.proof, encodeMintProof(proof.cadastreHash, proof.nonce, proof.deadline, proof.signature));

    const recovered = verifyTypedData(
      eip712Domain(31337, TOKEN),
      MINT_AUTH_TYPES,
      {
        to: INVESTOR,
        amount: 1_000n * 10n ** 18n,
        cadastreHash,
        nonce: 1n,
        deadline: 1_800_000_000n,
      },
      proof.signature,
    );
    assert.equal(recovered.toLowerCase(), wallet.address.toLowerCase());
  });

  it("blocks mint when the object is pledged", async () => {
    const bridge = new InMemorySmartBridge();
    bridge.seed({
      cadastralNumber: CADASTRAL,
      cadastreHash: hashCadastralNumber(CADASTRAL),
      objectName: "Pledged warehouse",
      encumbrance: "PLEDGED",
      encumbranceRef: "EGKN-ZALOG-9",
      asOf: new Date(),
      source: "SMART_BRIDGE",
    });

    await assert.rejects(
      () =>
        service(bridge).authorizeVerifiedMint({
          cadastralNumber: CADASTRAL,
          to: INVESTOR,
          amount: 1n,
        }),
      (error: unknown) => error instanceof CadastreOracleError && error.code === "ENCUMBERED",
    );
  });

  it("applies Notarial Fallback SOP when Smart Bridge is down", async () => {
    const wallet = Wallet.createRandom();
    const bridge = new InMemorySmartBridge();
    bridge.available = false;
    const now = new Date("2026-08-17T10:00:00Z");
    const cadastreHash = hashCadastralNumber(CADASTRAL);

    const proof = await service(bridge, wallet).authorizeVerifiedMint({
      cadastralNumber: CADASTRAL,
      to: INVESTOR,
      amount: 50n,
      now,
      notarialCase: {
        caseId: "NF-2026-014",
        cadastralNumber: CADASTRAL,
        cadastreHash,
        paperExtractHash: hashCadastralNumber("PAPER-EXTRACT-NF-2026-014"),
        legal: {
          role: "LEGAL",
          officerId: "legal.officer.1",
          qualifiedSignature: "QES-LEGAL-HARDWARE-TOKEN-001",
          approvedAt: new Date("2026-08-17T09:59:20Z"),
        },
        compliance: {
          role: "COMPLIANCE",
          officerId: "compliance.officer.1",
          qualifiedSignature: "QES-COMPLIANCE-HARDWARE-TOKEN-002",
          approvedAt: new Date("2026-08-17T09:59:40Z"),
        },
      },
    });

    assert.equal(proof.source, "NOTARIAL_FALLBACK");
    assert.equal(proof.cadastreHash, cadastreHash);
  });

  it("rejects fallback when Legal and Compliance are the same officer", async () => {
    const bridge = new InMemorySmartBridge();
    bridge.available = false;
    const now = new Date("2026-08-17T10:00:00Z");
    const approval = {
      officerId: "same.person",
      qualifiedSignature: "QES-HARDWARE-TOKEN-XYZ",
      approvedAt: now,
    };

    await assert.rejects(
      () =>
        service(bridge).authorizeVerifiedMint({
          cadastralNumber: CADASTRAL,
          to: INVESTOR,
          amount: 1n,
          now,
          notarialCase: {
            caseId: "NF-BAD",
            cadastralNumber: CADASTRAL,
            cadastreHash: hashCadastralNumber(CADASTRAL),
            paperExtractHash: hashCadastralNumber("PAPER"),
            legal: { role: "LEGAL", ...approval },
            compliance: { role: "COMPLIANCE", ...approval },
          },
        }),
      (error: unknown) => error instanceof CadastreOracleError && error.code === "FALLBACK_SOD",
    );
  });
});
