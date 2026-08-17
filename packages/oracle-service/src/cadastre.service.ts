import {
  AbiCoder,
  Signature,
  TypedDataEncoder,
  Wallet,
  getBytes,
  keccak256,
  toUtf8Bytes,
  verifyTypedData,
  type TypedDataDomain,
} from "ethers";

export const MINT_AUTH_TYPES: Record<string, Array<{ name: string; type: string }>> = {
  MintAuthorization: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "cadastreHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

export type EncumbranceStatus =
  | "CLEAR"
  | "PLEDGED"
  | "ARRESTED"
  | "LITIGATION"
  | "UNKNOWN";

export interface CadastreExtract {
  cadastralNumber: string;
  cadastreHash: `0x${string}`;
  objectName: string;
  encumbrance: EncumbranceStatus;
  encumbranceRef: string | null;
  asOf: Date;
  source: "SMART_BRIDGE" | "NOTARIAL_FALLBACK";
}

export interface MintAuthorization {
  to: string;
  amount: bigint;
  cadastreHash: `0x${string}`;
  nonce: bigint;
  deadline: bigint;
}

export interface OracleProof {
  cadastreHash: `0x${string}`;
  nonce: bigint;
  deadline: bigint;
  signature: `0x${string}`;
  proof: `0x${string}`;
  digest: `0x${string}`;
  source: CadastreExtract["source"];
}

export interface SmartBridgeClient {
  fetchCadastreExtract(cadastralNumber: string): Promise<CadastreExtract>;
}

export type OfficerRole = "LEGAL" | "COMPLIANCE";

export interface OfficerApproval {
  role: OfficerRole;
  officerId: string;
  qualifiedSignature: string;
  approvedAt: Date;
}

export interface NotarialCase {
  caseId: string;
  cadastralNumber: string;
  cadastreHash: `0x${string}`;
  paperExtractHash: `0x${string}`;
  legal: OfficerApproval;
  compliance: OfficerApproval;
}

export interface AuditEntry {
  at: Date;
  action: string;
  cadastralNumber?: string;
  cadastreHash?: `0x${string}`;
  detail: string;
}

export class CadastreOracleError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "CadastreOracleError";
    this.code = code;
  }
}

export interface CadastreServiceConfig {
  chainId: number;
  verifyingContract: string;
  oracleWallet: Wallet;
  smartBridge: SmartBridgeClient;
  bridgeTimeoutMs?: number;
  notarialWindowMs?: number;
  defaultProofTtlSec?: number;
}

const DOMAIN_NAME = "MulkToken";
const DOMAIN_VERSION = "1";
const CLEAR_STATUSES: ReadonlySet<EncumbranceStatus> = new Set(["CLEAR"]);

export function hashCadastralNumber(cadastralNumber: string): `0x${string}` {
  const normalized = cadastralNumber.trim().toUpperCase();
  if (normalized.length === 0) {
    throw new CadastreOracleError("EMPTY_CADASTRAL_NUMBER", "Cadastral number is required");
  }
  return keccak256(toUtf8Bytes(normalized)) as `0x${string}`;
}

export function eip712Domain(chainId: number, verifyingContract: string): TypedDataDomain {
  return {
    name: DOMAIN_NAME,
    version: DOMAIN_VERSION,
    chainId,
    verifyingContract,
  };
}

export function hashMintDigest(
  domain: TypedDataDomain,
  auth: MintAuthorization,
): `0x${string}` {
  return TypedDataEncoder.hash(domain, MINT_AUTH_TYPES, {
    to: auth.to,
    amount: auth.amount,
    cadastreHash: auth.cadastreHash,
    nonce: auth.nonce,
    deadline: auth.deadline,
  }) as `0x${string}`;
}

export function encodeMintProof(
  cadastreHash: `0x${string}`,
  nonce: bigint,
  deadline: bigint,
  signature: string,
): `0x${string}` {
  const compact = Signature.from(signature).serialized;
  return AbiCoder.defaultAbiCoder().encode(
    ["bytes32", "uint256", "uint256", "bytes"],
    [cadastreHash, nonce, deadline, compact],
  ) as `0x${string}`;
}

/**
 * Gov-Oracle / Smart Bridge gateway. After EGKN confirms the object is free of
 * pledge or arrest, produces the EIP-712 signature consumed by MulkToken.verifiedMint.
 * If Smart Bridge is down, Notarial Fallback SOP requires Legal + Compliance dual control.
 */
export class CadastreService {
  readonly auditLog: AuditEntry[] = [];
  private readonly bridgeTimeoutMs: number;
  private readonly notarialWindowMs: number;
  private readonly defaultProofTtlSec: number;
  private nonceCursor = 1n;

  constructor(private readonly config: CadastreServiceConfig) {
    this.bridgeTimeoutMs = config.bridgeTimeoutMs ?? 8_000;
    this.notarialWindowMs = config.notarialWindowMs ?? 30 * 60 * 1000;
    this.defaultProofTtlSec = config.defaultProofTtlSec ?? 3_600;
  }

  nextNonce(): bigint {
    const nonce = this.nonceCursor;
    this.nonceCursor = nonce + 1n;
    return nonce;
  }

  async authorizeVerifiedMint(params: {
    cadastralNumber: string;
    to: string;
    amount: bigint;
    nonce?: bigint;
    deadline?: bigint;
    now?: Date;
    notarialCase?: NotarialCase;
  }): Promise<OracleProof> {
    const now = params.now ?? new Date();
    const extract = await this.loadExtract(params.cadastralNumber, params.notarialCase, now);
    this.assertClearOfEncumbrance(extract);

    const expectedHash = hashCadastralNumber(params.cadastralNumber);
    if (extract.cadastreHash.toLowerCase() !== expectedHash.toLowerCase()) {
      throw new CadastreOracleError(
        "HASH_MISMATCH",
        `Extract hash ${extract.cadastreHash} does not match ${expectedHash}`,
      );
    }

    const nonce = params.nonce ?? this.nextNonce();
    const deadline = params.deadline ?? BigInt(Math.floor(now.getTime() / 1000) + this.defaultProofTtlSec);
    const auth: MintAuthorization = {
      to: params.to,
      amount: params.amount,
      cadastreHash: extract.cadastreHash,
      nonce,
      deadline,
    };

    const domain = eip712Domain(this.config.chainId, this.config.verifyingContract);
    const signature = (await this.config.oracleWallet.signTypedData(
      domain,
      MINT_AUTH_TYPES,
      auth,
    )) as `0x${string}`;
    const recovered = verifyTypedData(domain, MINT_AUTH_TYPES, auth, signature);
    if (recovered.toLowerCase() !== this.config.oracleWallet.address.toLowerCase()) {
      throw new CadastreOracleError("SIGNER_MISMATCH", "Recovered signer is not the isolated oracle key");
    }

    const proof = encodeMintProof(extract.cadastreHash, nonce, deadline, signature);
    const digest = hashMintDigest(domain, auth);
    this.audit({
      at: now,
      action: "MINT_PROOF_ISSUED",
      cadastralNumber: params.cadastralNumber,
      cadastreHash: extract.cadastreHash,
      detail: `source=${extract.source} to=${params.to} amount=${params.amount.toString()} nonce=${nonce.toString()}`,
    });

    return {
      cadastreHash: extract.cadastreHash,
      nonce,
      deadline,
      signature,
      proof,
      digest,
      source: extract.source,
    };
  }

  validateNotarialFallback(notarialCase: NotarialCase, now: Date): void {
    if (notarialCase.legal.role !== "LEGAL" || notarialCase.compliance.role !== "COMPLIANCE") {
      throw new CadastreOracleError("FALLBACK_ROLES", "Notarial SOP requires LEGAL and COMPLIANCE approvals");
    }
    if (notarialCase.legal.officerId === notarialCase.compliance.officerId) {
      throw new CadastreOracleError("FALLBACK_SOD", "Segregation of duties: Legal and Compliance must be distinct officers");
    }
    if (notarialCase.legal.qualifiedSignature.length < 16 || notarialCase.compliance.qualifiedSignature.length < 16) {
      throw new CadastreOracleError("FALLBACK_QES", "Each officer must attach a qualified e-signature or hardware TOTP");
    }
    if (notarialCase.cadastreHash.toLowerCase() !== hashCadastralNumber(notarialCase.cadastralNumber).toLowerCase()) {
      throw new CadastreOracleError("FALLBACK_HASH", "Notarial case cadastre hash does not match the cadastral number");
    }
    if (getBytes(notarialCase.paperExtractHash).length !== 32) {
      throw new CadastreOracleError("FALLBACK_EXTRACT", "Paper EGKN extract hash must be 32 bytes");
    }

    const legalTs = notarialCase.legal.approvedAt.getTime();
    const complianceTs = notarialCase.compliance.approvedAt.getTime();
    const nowTs = now.getTime();
    if (Math.abs(legalTs - complianceTs) > this.notarialWindowMs) {
      throw new CadastreOracleError("FALLBACK_WINDOW", "Legal and Compliance approvals are outside the dual-control window");
    }
    if (nowTs - Math.max(legalTs, complianceTs) > this.notarialWindowMs) {
      throw new CadastreOracleError("FALLBACK_STALE", "Notarial dual-control approvals have expired");
    }
  }

  private async loadExtract(
    cadastralNumber: string,
    notarialCase: NotarialCase | undefined,
    now: Date,
  ): Promise<CadastreExtract> {
    try {
      const extract = await this.withTimeout(
        this.config.smartBridge.fetchCadastreExtract(cadastralNumber),
        this.bridgeTimeoutMs,
      );
      this.audit({
        at: now,
        action: "SMART_BRIDGE_OK",
        cadastralNumber,
        cadastreHash: extract.cadastreHash,
        detail: `encumbrance=${extract.encumbrance}`,
      });
      return { ...extract, source: "SMART_BRIDGE" };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.audit({
        at: now,
        action: "SMART_BRIDGE_UNAVAILABLE",
        cadastralNumber,
        detail: reason,
      });
      if (!notarialCase) {
        throw new CadastreOracleError(
          "BRIDGE_DOWN_NO_FALLBACK",
          `Smart Bridge unavailable (${reason}). Submit a Notarial Fallback case (Legal + Compliance).`,
        );
      }
      if (notarialCase.cadastralNumber.trim().toUpperCase() !== cadastralNumber.trim().toUpperCase()) {
        throw new CadastreOracleError("FALLBACK_OBJECT_MISMATCH", "Notarial case object does not match the mint request");
      }
      this.validateNotarialFallback(notarialCase, now);
      this.audit({
        at: now,
        action: "NOTARIAL_FALLBACK_ACCEPTED",
        cadastralNumber,
        cadastreHash: notarialCase.cadastreHash,
        detail: `caseId=${notarialCase.caseId} legal=${notarialCase.legal.officerId} compliance=${notarialCase.compliance.officerId}`,
      });
      return {
        cadastralNumber,
        cadastreHash: notarialCase.cadastreHash,
        objectName: "EGKN paper extract (notarial fallback)",
        encumbrance: "CLEAR",
        encumbranceRef: null,
        asOf: now,
        source: "NOTARIAL_FALLBACK",
      };
    }
  }

  private assertClearOfEncumbrance(extract: CadastreExtract): void {
    if (!CLEAR_STATUSES.has(extract.encumbrance)) {
      throw new CadastreOracleError(
        "ENCUMBERED",
        `EGKN object ${extract.cadastralNumber} is ${extract.encumbrance} (ref=${extract.encumbranceRef ?? "n/a"}). Mint blocked.`,
      );
    }
  }

  private audit(entry: AuditEntry): void {
    this.auditLog.push(entry);
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new CadastreOracleError("BRIDGE_TIMEOUT", `Smart Bridge exceeded ${ms}ms`));
      }, ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}

export class InMemorySmartBridge implements SmartBridgeClient {
  available = true;
  readonly extracts = new Map<string, CadastreExtract>();

  seed(extract: CadastreExtract): void {
    this.extracts.set(extract.cadastralNumber.trim().toUpperCase(), extract);
  }

  async fetchCadastreExtract(cadastralNumber: string): Promise<CadastreExtract> {
    if (!this.available) {
      throw new Error("Smart Bridge HTTP 503");
    }
    const row = this.extracts.get(cadastralNumber.trim().toUpperCase());
    if (!row) {
      throw new CadastreOracleError("NOT_FOUND", `EGKN object ${cadastralNumber} not found`);
    }
    return { ...row, asOf: new Date(), source: "SMART_BRIDGE" };
  }
}
