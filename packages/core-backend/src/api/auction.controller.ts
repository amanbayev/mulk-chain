import { timingSafeEqual } from "node:crypto";
import type { Hono } from "hono";
import { ApiError, respond } from "./errors.js";
import type { PlatformService } from "./platform.service.js";
import { ClearAuctionBodySchema } from "./schemas.js";

export const auctionOpenApi = [
  {
    method: "get",
    path: "/api/v1/auction/status",
    tags: ["Auction"],
    summary: "Current trading window, NAV ±10% collar and indicative volumes",
  },
  {
    method: "post",
    path: "/api/v1/auction/clear",
    tags: ["Auction"],
    summary: "Admin-triggered batch clearing of the open auction window",
  },
] as const;

export class AuctionController {
  constructor(
    private readonly platform: PlatformService,
    private readonly adminApiKey: string,
  ) {}

  register(app: Hono): void {
    app.get("/api/v1/auction/status", (c) => {
      const assetId = c.req.query("assetId");
      const intervalId = c.req.query("intervalId");
      const status = intervalId
        ? this.platform.auction.getStatus(intervalId)
        : this.platform.auction.findOpenInterval(assetId);
      if (!status) {
        throw new ApiError(404, "NO_AUCTION", "no matching auction window");
      }
      return respond(c, {
        ...status,
        collarBps: status.collarBps.toString(),
        priceCollar: "NAV ±10%",
      });
    });

    app.post("/api/v1/auction/clear", async (c) => {
      this.assertAdmin(c.req.header("x-admin-key") ?? c.req.header("authorization"));
      const body = ClearAuctionBodySchema.parse((await c.req.json().catch(() => ({}))) as unknown);
      const status = body.intervalId
        ? this.platform.auction.getStatus(body.intervalId)
        : this.platform.auction.findOpenInterval(body.assetId);
      if (!status || !status.open) {
        throw new ApiError(409, "NO_OPEN_AUCTION", "no open auction window to clear");
      }
      const { batch, settlements } = await this.platform.clearAndSettle(status.intervalId);
      return respond(c, {
        intervalId: batch.intervalId,
        batchId: batch.batchId,
        fingerprint: batch.fingerprint,
        equilibriumPrice: batch.equilibriumPrice,
        executableVolume: batch.executableVolume,
        tradeCount: batch.trades.length,
        trades: batch.trades,
        settlements: settlements.map((record) => ({
          instructionId: record.instruction.id,
          status: record.status,
          cashReleased: record.cashReleased,
          tokensReleased: record.tokensReleased,
          cashLock: record.cashLock,
          tokenLock: record.tokenLock,
          saga: record.saga,
        })),
      });
    });
  }

  private assertAdmin(header: string | undefined): void {
    const provided = header?.startsWith("Bearer ") ? header.slice(7) : header;
    if (!provided) throw new ApiError(401, "ADMIN_REQUIRED", "admin API key is required");
    const expected = Buffer.from(this.adminApiKey, "utf8");
    const received = Buffer.from(provided, "utf8");
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
      throw new ApiError(403, "ADMIN_FORBIDDEN", "invalid admin API key");
    }
  }
}
