import type { Hono } from "hono";
import { respond } from "./errors.js";
import type { PlatformService } from "./platform.service.js";
import { MintRequestBodySchema, RegisterAssetBodySchema, TriggerYieldBodySchema } from "./schemas.js";

export const issuerOpenApi = [
  {
    method: "post",
    path: "/api/v1/issuer/assets",
    tags: ["Issuer"],
    summary: "Register a tokenized property (cadastral number, SPV, NAV)",
  },
  {
    method: "post",
    path: "/api/v1/issuer/mint/request",
    tags: ["Issuer"],
    summary: "Request a Gov-Oracle verified mint authorization",
  },
  {
    method: "post",
    path: "/api/v1/issuer/yield/trigger",
    tags: ["Issuer"],
    summary: "Trigger NOI rental-yield distribution for an asset",
  },
] as const;

export class IssuerController {
  constructor(private readonly platform: PlatformService) {}

  register(app: Hono): void {
    app.post("/api/v1/issuer/assets", async (c) => {
      const body = RegisterAssetBodySchema.parse(await c.req.json());
      return respond(c, this.platform.registerAsset(body), 201);
    });

    app.post("/api/v1/issuer/mint/request", async (c) => {
      const body = MintRequestBodySchema.parse(await c.req.json());
      return respond(c, await this.platform.requestMint(body), 201);
    });

    app.post("/api/v1/issuer/yield/trigger", async (c) => {
      const body = TriggerYieldBodySchema.parse(await c.req.json());
      return respond(c, await this.platform.triggerYield(body), 201);
    });
  }
}
