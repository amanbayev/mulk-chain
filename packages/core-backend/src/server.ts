import { serve } from "@hono/node-server";
import { createGatewayStack } from "./api/compose.js";

const port = Number(process.env.PORT ?? process.env.CORE_BACKEND_PORT ?? 8787);
const stack = createGatewayStack({
  webhookSecret: process.env.KYC_WEBHOOK_SECRET,
  adminApiKey: process.env.ADMIN_API_KEY,
});

stack.app.get("/healthz", (c) => c.json({ ok: true, service: "core-backend" }));

serve({ fetch: stack.app.fetch, port }, (info) => {
  const host = `http://127.0.0.1:${info.port}`;
  console.log(`[core-backend] API Gateway ${host}`);
  console.log(`[core-backend] OpenAPI     ${host}/api/v1/docs`);
});
