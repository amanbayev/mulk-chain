import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import type { BatchAuctionEngine } from "../auction/batch-auction.engine.js";
import { WebhookSignatureError } from "../identity/hmac.js";
import type { KycWebhookController } from "../identity/kyc-webhook.controller.js";
import { AuctionController } from "./auction.controller.js";
import { ApiError, jsonSafe, respond } from "./errors.js";
import { InvestorController } from "./investor.controller.js";
import { IssuerController } from "./issuer.controller.js";
import { buildOpenApiDocument, swaggerHtml } from "./openapi.js";
import type { PlatformService } from "./platform.service.js";

export interface GatewayDeps {
  platform: PlatformService;
  auction: BatchAuctionEngine;
  kycWebhook: KycWebhookController;
  adminApiKey: string;
}

export function createApiGateway(deps: GatewayDeps): Hono {
  const app = new Hono();

  new InvestorController(deps.platform).register(app);
  new IssuerController(deps.platform).register(app);
  new AuctionController(deps.auction, deps.adminApiKey).register(app);

  app.post("/api/v1/webhooks/kyc/:provider", async (c) => {
    const rawBody = await c.req.text();
    const headers: Record<string, string | undefined> = {
      "x-payload-digest": c.req.header("x-payload-digest"),
      "x-sumsub-payload-digest": c.req.header("x-sumsub-payload-digest"),
      "x-signature-sha256": c.req.header("x-signature-sha256"),
      "x-hub-signature-256": c.req.header("x-hub-signature-256"),
    };
    const result = await deps.kycWebhook.handle(c.req.param("provider"), headers, rawBody);
    return respond(c, result);
  });

  app.get("/api/v1/openapi.json", (c) => c.json(buildOpenApiDocument()));
  app.get("/api/v1/docs", (c) => c.html(swaggerHtml("/api/v1/openapi.json")));

  app.onError((error, c) => {
    if (error instanceof WebhookSignatureError) {
      return c.json({ code: "INVALID_SIGNATURE", message: error.message }, 401);
    }
    if (error instanceof SyntaxError) {
      return c.json({ code: "INVALID_JSON", message: error.message }, 400);
    }
    if (error instanceof ApiError) {
      return c.json({ code: error.code, message: error.message }, error.status as ContentfulStatusCode);
    }
    if (error instanceof ZodError) {
      return c.json(
        {
          code: "VALIDATION_ERROR",
          message: "request validation failed",
          issues: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
        },
        400,
      );
    }
    return c.json(jsonSafe({ code: "INTERNAL_ERROR", message: error.message }) as Record<string, unknown>, 500);
  });

  return app;
}
