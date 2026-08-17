import { createHmac, timingSafeEqual } from "node:crypto";

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

function normalizeHeader(header: string): string {
  const trimmed = header.trim();
  const prefixed = trimmed.match(/^sha256=/i);
  return (prefixed ? trimmed.slice(prefixed[0].length) : trimmed).toLowerCase();
}

function hmacHex(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/** Timing-safe HMAC-SHA256 check. Accepts raw hex or `sha256=<hex>`. */
export function verifyHmacSha256(rawBody: string, secret: string, providedHeader: string | undefined): void {
  if (!providedHeader || providedHeader.trim().length === 0) {
    throw new WebhookSignatureError("missing webhook signature");
  }
  const expected = hmacHex(secret, rawBody);
  const received = normalizeHeader(providedHeader);
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(received, "utf8");
  if (expectedBuf.length !== receivedBuf.length || !timingSafeEqual(expectedBuf, receivedBuf)) {
    throw new WebhookSignatureError("invalid webhook HMAC-SHA256 signature");
  }
}

export function signHmacSha256(rawBody: string, secret: string): string {
  return hmacHex(secret, rawBody);
}
