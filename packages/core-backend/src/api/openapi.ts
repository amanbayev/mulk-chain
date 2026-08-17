import { auctionOpenApi } from "./auction.controller.js";
import { investorOpenApi } from "./investor.controller.js";
import { issuerOpenApi } from "./issuer.controller.js";

const webhookOpenApi = [
  {
    method: "post",
    path: "/api/v1/webhooks/kyc/{provider}",
    tags: ["Identity"],
    summary: "KYC provider webhook (HMAC-SHA256). Issues OnchainID claims and syncs IdentityRegistry",
  },
];

export function buildOpenApiDocument(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of [...investorOpenApi, ...issuerOpenApi, ...auctionOpenApi, ...webhookOpenApi]) {
    const path = route.path.replace(/:([A-Za-z]+)/g, "{$1}");
    const item = paths[path] ?? {};
    item[route.method] = {
      tags: [...route.tags],
      summary: route.summary,
      responses: {
        "200": { description: "Success" },
        "201": { description: "Created" },
        "400": { description: "Validation error" },
        "401": { description: "Unauthorized" },
        "403": { description: "Forbidden" },
      },
    };
    paths[path] = item;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Mülk Chain API Gateway",
      version: "1.0.0",
      description:
        "Identity & Compliance Hub and REST gateway for investor onboarding, batch auctions, verified mint and NOI yield.",
    },
    tags: [
      { name: "Investor" },
      { name: "Issuer" },
      { name: "Auction" },
      { name: "Identity" },
    ],
    paths,
    components: {
      securitySchemes: {
        AdminKey: { type: "apiKey", in: "header", name: "x-admin-key" },
        WebhookHmac: { type: "apiKey", in: "header", name: "x-payload-digest" },
      },
    },
  };
}

export function swaggerHtml(specUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Mülk Chain API</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: ${JSON.stringify(specUrl)}, dom_id: "#swagger-ui" });
  </script>
</body>
</html>`;
}
