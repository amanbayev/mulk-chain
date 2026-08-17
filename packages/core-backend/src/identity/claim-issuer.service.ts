import { AbiCoder, BaseWallet, TypedDataEncoder, keccak256, verifyTypedData, type TypedDataDomain } from "ethers";
import { ClaimTopic, type ClaimTopicId, type InvestorClass } from "./schemas.js";

export const CLAIM_TYPES: Record<string, Array<{ name: string; type: string }>> = {
  IdentityClaim: [
    { name: "topic", type: "uint256" },
    { name: "identity", type: "address" },
    { name: "wallet", type: "address" },
    { name: "dataHash", type: "bytes32" },
    { name: "issuedAt", type: "uint256" },
    { name: "expiresAt", type: "uint256" },
  ],
};

export interface IssuedClaim {
  topic: ClaimTopicId;
  topicName: keyof typeof ClaimTopic;
  identity: string;
  wallet: string;
  dataHash: `0x${string}`;
  issuedAt: bigint;
  expiresAt: bigint;
  signature: `0x${string}`;
  digest: `0x${string}`;
  issuer: string;
}

export interface ClaimIssuerConfig {
  chainId: number;
  verifyingContract: string;
  issuerWallet: BaseWallet;
  ttlSec?: number;
}

export class ClaimIssuerService {
  private readonly ttlSec: number;

  constructor(private readonly config: ClaimIssuerConfig) {
    this.ttlSec = config.ttlSec ?? 365 * 24 * 60 * 60;
  }

  get domain(): TypedDataDomain {
    return {
      name: "MulkIdentity",
      version: "1",
      chainId: this.config.chainId,
      verifyingContract: this.config.verifyingContract,
    };
  }

  async issueKycValid(identity: string, wallet: string, provider: string, applicantId: string, now = new Date()): Promise<IssuedClaim> {
    const dataHash = keccak256(
      AbiCoder.defaultAbiCoder().encode(["address", "bool", "string", "string"], [wallet, true, provider, applicantId]),
    ) as `0x${string}`;
    return this.sign(ClaimTopic.CLAIM_KYC_VALID, "CLAIM_KYC_VALID", identity, wallet, dataHash, now);
  }

  async issueInvestorClass(identity: string, wallet: string, investorClass: InvestorClass, now = new Date()): Promise<IssuedClaim> {
    const dataHash = keccak256(
      AbiCoder.defaultAbiCoder().encode(["address", "string"], [wallet, investorClass]),
    ) as `0x${string}`;
    return this.sign(ClaimTopic.CLAIM_INVESTOR_CLASS, "CLAIM_INVESTOR_CLASS", identity, wallet, dataHash, now);
  }

  async issueSanctionsClear(identity: string, wallet: string, pep: boolean, now = new Date()): Promise<IssuedClaim> {
    const dataHash = keccak256(
      AbiCoder.defaultAbiCoder().encode(["address", "bool", "bool"], [wallet, true, pep]),
    ) as `0x${string}`;
    return this.sign(ClaimTopic.CLAIM_SANCTIONS_CLEAR, "CLAIM_SANCTIONS_CLEAR", identity, wallet, dataHash, now);
  }

  verify(claim: IssuedClaim): boolean {
    const recovered = verifyTypedData(
      this.domain,
      CLAIM_TYPES,
      {
        topic: BigInt(claim.topic),
        identity: claim.identity,
        wallet: claim.wallet,
        dataHash: claim.dataHash,
        issuedAt: claim.issuedAt,
        expiresAt: claim.expiresAt,
      },
      claim.signature,
    );
    return recovered.toLowerCase() === this.config.issuerWallet.address.toLowerCase();
  }

  private async sign(
    topic: ClaimTopicId,
    topicName: keyof typeof ClaimTopic,
    identity: string,
    wallet: string,
    dataHash: `0x${string}`,
    now: Date,
  ): Promise<IssuedClaim> {
    const issuedAt = BigInt(Math.floor(now.getTime() / 1000));
    const expiresAt = issuedAt + BigInt(this.ttlSec);
    const value = { topic: BigInt(topic), identity, wallet, dataHash, issuedAt, expiresAt };
    const digest = TypedDataEncoder.hash(this.domain, CLAIM_TYPES, value) as `0x${string}`;
    const signature = (await this.config.issuerWallet.signTypedData(this.domain, CLAIM_TYPES, value)) as `0x${string}`;
    return {
      topic,
      topicName,
      identity,
      wallet,
      dataHash,
      issuedAt,
      expiresAt,
      signature,
      digest,
      issuer: this.config.issuerWallet.address,
    };
  }
}
