#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE =
  process.env.RISKSTATE_API_URL || "https://riskstate.netlify.app";

const server = new McpServer({
  name: "riskstate",
  version: "1.0.0",
});

server.tool(
  "get_risk_policy",
  "Get the current risk governance policy for a crypto asset. Returns policy level (BLOCK/CAUTIOUS/GREEN), max position size, leverage limits, allowed and blocked actions, and confidence score. Call this BEFORE every trade to determine how much risk is allowed.",
  {
    asset: z.enum(["BTC", "ETH"]).describe("Asset to get risk policy for"),
    wallet_address: z
      .string()
      .optional()
      .describe(
        "DeFi wallet address for on-chain position data (LTV, health factor)"
      ),
    protocol: z
      .enum(["spark", "aave"])
      .optional()
      .describe("DeFi lending protocol (default: spark)"),
    include_details: z
      .boolean()
      .optional()
      .describe(
        "Include detailed breakdown: composite subscores, macro data, risk flags, data sources"
      ),
  },
  async (input) => {
    const apiKey = process.env.RISKSTATE_API_KEY;
    if (!apiKey) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error: RISKSTATE_API_KEY environment variable is required. Get a free API key at https://riskstate.ai",
          },
        ],
        isError: true,
      };
    }

    const body: Record<string, unknown> = { asset: input.asset };
    if (input.wallet_address) body.wallet_address = input.wallet_address;
    if (input.protocol) body.protocol = input.protocol;
    if (input.include_details) body.include_details = input.include_details;

    try {
      const response = await fetch(`${API_BASE}/v1/risk-state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const status = response.status;
        const errorText = await response.text().catch(() => "");

        let message: string;
        if (status === 401) {
          message =
            "Authentication failed. Check your RISKSTATE_API_KEY is valid.";
        } else if (status === 429) {
          message =
            "Rate limited. Wait 60 seconds before retrying. Limit: 60 requests/minute.";
        } else if (status === 400) {
          message = `Bad request: ${errorText || "check parameters"}`;
        } else if (status >= 500) {
          message = `Server error (${status}). Retry in 30 seconds.`;
        } else {
          message = `HTTP ${status}: ${errorText || "Unknown error"}`;
        }

        return {
          content: [{ type: "text" as const, text: message }],
          isError: true,
        };
      }

      const data = await response.json();

      // Build human-readable summary for quick agent parsing
      const policy = data.exposure_policy || {};
      const classification = data.classification || {};
      const audit = data.auditability || {};

      const summary = [
        `POLICY: ${policy.policy_level || "UNKNOWN"}`,
        `MAX SIZE: ${policy.max_size_pct ?? "?"}%`,
        `LEVERAGE: ${policy.leverage_max ?? "?"}x`,
        `BLOCKED: ${(policy.blocked_actions || []).join(", ") || "none"}`,
        `REGIME: ${classification.market_regime || "?"} | DIRECTION: ${classification.direction || "?"}`,
        `COMPOSITE: ${audit.composite_score ?? "?"} | CONFIDENCE: ${audit.confidence_score ?? "?"}`,
        `TTL: ${audit.ttl_seconds ?? 60}s`,
      ].join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: summary + "\n\n" + JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.name === "TimeoutError" || err.name === "AbortError"
            ? "Request timed out after 15s. The API may be under heavy load — retry in 30s."
            : `Network error: ${err.message}`
          : "Unknown error";
      return {
        content: [{ type: "text" as const, text: message }],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start RiskState MCP server:", err);
  process.exit(1);
});
