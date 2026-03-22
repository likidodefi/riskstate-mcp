import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the tool handler logic by extracting the core behavior.
// Since the MCP SDK wires tools internally, we test the fetch + response logic directly.

const API_BASE = "https://riskstate.netlify.app";

// Mock response factory
function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    headers: new Headers(),
    redirected: false,
    statusText: "",
    type: "basic" as ResponseType,
    url: "",
    clone: () => mockResponse(status, body),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
    bytes: async () => new Uint8Array(),
  } as Response;
}

// Extracted handler logic (mirrors src/index.ts tool handler)
async function handleGetRiskPolicy(
  input: {
    asset: string;
    wallet_address?: string;
    protocol?: string;
    include_details?: boolean;
  },
  apiKey: string | undefined,
  fetchFn: typeof fetch
) {
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
    const response = await fetchFn(`${API_BASE}/v1/risk-state`, {
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

describe("get_risk_policy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when API key is missing", async () => {
    const result = await handleGetRiskPolicy(
      { asset: "BTC" },
      undefined,
      vi.fn()
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("RISKSTATE_API_KEY");
  });

  it("returns formatted policy on successful response", async () => {
    const apiData = {
      exposure_policy: {
        policy_level: "GREEN_SELECTIVE",
        max_size_pct: 65,
        leverage_max: 2,
        blocked_actions: [],
        allowed_actions: ["LONG", "SHORT", "DCA"],
      },
      classification: {
        market_regime: "RANGE",
        direction: "SIDEWAYS",
      },
      auditability: {
        composite_score: 58,
        confidence_score: 72,
        ttl_seconds: 60,
      },
    };

    const fetchFn = vi.fn().mockResolvedValue(mockResponse(200, apiData));
    const result = await handleGetRiskPolicy(
      { asset: "BTC" },
      "test-key",
      fetchFn
    );

    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("POLICY: GREEN_SELECTIVE");
    expect(result.content[0].text).toContain("MAX SIZE: 65%");
    expect(result.content[0].text).toContain("LEVERAGE: 2x");
    expect(result.content[0].text).toContain("BLOCKED: none");
    expect(result.content[0].text).toContain("COMPOSITE: 58");
    // Verify JSON is appended
    expect(result.content[0].text).toContain('"policy_level"');
  });

  it("returns auth error on 401", async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse(401, {}));
    const result = await handleGetRiskPolicy(
      { asset: "ETH" },
      "bad-key",
      fetchFn
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Authentication failed");
  });

  it("returns rate limit message on 429", async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse(429, {}));
    const result = await handleGetRiskPolicy(
      { asset: "BTC" },
      "test-key",
      fetchFn
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Rate limited");
    expect(result.content[0].text).toContain("60 seconds");
  });

  it("returns server error message on 500", async () => {
    const fetchFn = vi.fn().mockResolvedValue(mockResponse(500, {}));
    const result = await handleGetRiskPolicy(
      { asset: "BTC" },
      "test-key",
      fetchFn
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Server error (500)");
    expect(result.content[0].text).toContain("Retry in 30 seconds");
  });

  it("returns bad request message on 400", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(mockResponse(400, "invalid asset"));
    const result = await handleGetRiskPolicy(
      { asset: "BTC" },
      "test-key",
      fetchFn
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Bad request");
  });

  it("handles network timeout", async () => {
    const timeoutError = new Error("timeout");
    timeoutError.name = "TimeoutError";
    const fetchFn = vi.fn().mockRejectedValue(timeoutError);

    const result = await handleGetRiskPolicy(
      { asset: "BTC" },
      "test-key",
      fetchFn
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("timed out after 15s");
  });

  it("handles generic network error", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await handleGetRiskPolicy(
      { asset: "BTC" },
      "test-key",
      fetchFn
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Network error: ECONNREFUSED");
  });

  it("sends correct request body with all parameters", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      mockResponse(200, {
        exposure_policy: {},
        classification: {},
        auditability: {},
      })
    );

    await handleGetRiskPolicy(
      {
        asset: "ETH",
        wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
        protocol: "aave",
        include_details: true,
      },
      "test-key",
      fetchFn
    );

    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe("https://riskstate.netlify.app/v1/risk-state");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body)).toEqual({
      asset: "ETH",
      wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
      protocol: "aave",
      include_details: true,
    });
    expect(options.headers.Authorization).toBe("Bearer test-key");
  });

  it("handles blocked actions in summary", async () => {
    const apiData = {
      exposure_policy: {
        policy_level: "BLOCK_SURVIVAL",
        max_size_pct: 0,
        leverage_max: 1,
        blocked_actions: ["NEW_TRADES", "LEVERAGE_GT_2X"],
        allowed_actions: ["REDUCE", "HEDGE"],
      },
      classification: { market_regime: "PANIC", direction: "BEAR" },
      auditability: { composite_score: 15, confidence_score: 40, ttl_seconds: 60 },
    };

    const fetchFn = vi.fn().mockResolvedValue(mockResponse(200, apiData));
    const result = await handleGetRiskPolicy(
      { asset: "BTC" },
      "test-key",
      fetchFn
    );

    expect(result.content[0].text).toContain("BLOCKED: NEW_TRADES, LEVERAGE_GT_2X");
    expect(result.content[0].text).toContain("REGIME: PANIC | DIRECTION: BEAR");
  });
});
