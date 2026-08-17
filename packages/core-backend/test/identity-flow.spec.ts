import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import { createGatewayStack } from "../src/api/compose.js";
import { signHmacSha256 } from "../src/identity/hmac.js";
import { ClaimTopic } from "../src/identity/schemas.js";

describe("Identity flow: Sumsub webhook → claims → IdentityRegistry", () => {
  it("issues KYC, class and sanctions claims and syncs the on-chain registry", async () => {
    const stack = createGatewayStack();
    const investor = Wallet.createRandom();
    const onchainId = Wallet.createRandom();
    const payload = {
      provider: "SUMSUB",
      applicantId: "sumsub-1",
      investorId: "inv-1",
      wallet: investor.address,
      onchainId: onchainId.address,
      reviewStatus: "completed",
      reviewAnswer: "GREEN",
      applicantType: "individual",
      pep: false,
      sanctionsHit: false,
      professional: true,
      accredited: false,
      aifcLicense: false,
      country: "KZ",
    };
    const rawBody = JSON.stringify(payload);
    const digest = signHmacSha256(rawBody, stack.webhookSecret);

    const response = await stack.app.request("/api/v1/webhooks/kyc/sumsub", {
      method: "POST",
      headers: { "content-type": "application/json", "x-payload-digest": digest },
      body: rawBody,
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      kycValid: boolean;
      investorClass: string;
      claimsIssued: number;
      jobsEnqueued: number;
    };
    expect(body.kycValid).toBe(true);
    expect(body.investorClass).toBe("PROFESSIONAL");
    expect(body.claimsIssued).toBe(3);
    expect(body.jobsEnqueued).toBe(4);

    const results = await stack.syncer.processQueue();
    expect(results.every((row) => row.ok)).toBe(true);
    expect(stack.registry.transactions.map((tx) => tx.method)).toEqual([
      "registerIdentity",
      "setClaim",
      "setClaim",
      "setClaim",
    ]);

    const onchain = stack.registry.identities.get(investor.address.toLowerCase());
    expect(onchain?.verified).toBe(true);
    expect(onchain?.onchainId).toBe(onchainId.address);
    expect(onchain?.claims.map((claim) => claim.topic).sort()).toEqual([
      ClaimTopic.CLAIM_KYC_VALID,
      ClaimTopic.CLAIM_INVESTOR_CLASS,
      ClaimTopic.CLAIM_SANCTIONS_CLEAR,
    ]);
    for (const claim of onchain?.claims ?? []) {
      expect(stack.claims.verify(claim)).toBe(true);
    }
  });

  it("rejects a webhook with an invalid HMAC and does not enqueue registry jobs", async () => {
    const stack = createGatewayStack();
    const investor = Wallet.createRandom();
    const rawBody = JSON.stringify({
      provider: "SUMSUB",
      applicantId: "x",
      investorId: "inv-bad",
      wallet: investor.address,
      onchainId: Wallet.createRandom().address,
      reviewStatus: "completed",
      reviewAnswer: "GREEN",
    });
    const response = await stack.app.request("/api/v1/webhooks/kyc/sumsub", {
      method: "POST",
      headers: { "content-type": "application/json", "x-payload-digest": "00".repeat(32) },
      body: rawBody,
    });
    expect(response.status).toBe(401);
    expect(stack.syncer.queue).toHaveLength(0);
    expect(stack.registry.identities.size).toBe(0);
  });
});
