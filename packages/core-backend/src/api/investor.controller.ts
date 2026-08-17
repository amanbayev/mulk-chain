import type { Hono } from "hono";
import { ApiError, respond } from "./errors.js";
import type { PlatformService } from "./platform.service.js";
import { InitKycBodySchema, SubmitOrderBodySchema } from "./schemas.js";

export const investorOpenApi = [
  {
    method: "post",
    path: "/api/v1/investor/kyc/init",
    tags: ["Investor"],
    summary: "Start investor KYC onboarding (Sumsub / eGov Mobile / DID)",
  },
  {
    method: "get",
    path: "/api/v1/investor/portfolio",
    tags: ["Investor"],
    summary: "Token balances, accrued dividends and transaction history",
  },
  {
    method: "post",
    path: "/api/v1/investor/orders",
    tags: ["Investor"],
    summary: "Submit a limit order into the current batch-auction window",
  },
  {
    method: "get",
    path: "/api/v1/investor/yield/history",
    tags: ["Investor"],
    summary: "Rental yield (NOI) payment history",
  },
] as const;

export class InvestorController {
  constructor(private readonly platform: PlatformService) {}

  register(app: Hono): void {
    app.post("/api/v1/investor/kyc/init", async (c) => {
      const body = InitKycBodySchema.parse(await c.req.json());
      return respond(c, this.platform.initKyc(body), 201);
    });

    app.get("/api/v1/investor/portfolio", (c) => {
      const investorId = c.req.query("investorId");
      if (!investorId) throw new ApiError(400, "MISSING_INVESTOR", "investorId query is required");
      return respond(c, this.platform.portfolio(investorId));
    });

    app.post("/api/v1/investor/orders", async (c) => {
      const body = SubmitOrderBodySchema.parse(await c.req.json());
      return respond(c, this.platform.placeOrder(body), 201);
    });

    app.get("/api/v1/investor/yield/history", (c) => {
      const investorId = c.req.query("investorId");
      if (!investorId) throw new ApiError(400, "MISSING_INVESTOR", "investorId query is required");
      return respond(c, { investorId, distributions: this.platform.yieldHistoryFor(investorId) });
    });
  }
}
