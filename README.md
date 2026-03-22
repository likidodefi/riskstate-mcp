# RiskState MCP Server

MCP server for [RiskState](https://riskstate.ai) — deterministic risk governance API for autonomous crypto trading agents.

Your agent asks: **"How much can I risk?"**
RiskState answers with: policy level, max position size, leverage limits, blocked actions.

[![riskstate-mcp MCP server](https://glama.ai/mcp/servers/likidodefi/riskstate-mcp/badges/card.svg)](https://glama.ai/mcp/servers/likidodefi/riskstate-mcp)

## What it does

Wraps the [RiskState `/v1/risk-state` API](https://github.com/likidodefi/riskstate-docs) as an MCP tool. One tool: `get_risk_policy`.

| Field | Description |
|-------|-------------|
| `policy_level` | 5 levels: BLOCK_SURVIVAL, BLOCK_DEFENSIVE, CAUTIOUS, GREEN_SELECTIVE, GREEN_EXPANSION |
| `max_size_pct` | Maximum position size as % of portfolio (0-100) |
| `leverage_max` | Maximum allowed leverage multiplier |
| `allowed_actions` | What the agent CAN do at this policy level |
| `blocked_actions` | What the agent CANNOT do |
| `confidence_score` | Signal agreement x data quality (0-1) |

The API aggregates 9+ real-time data sources server-side. See [API docs](https://github.com/likidodefi/riskstate-docs) for details.

## What this wrapper does (and doesn't)

This is a **thin wrapper** — it translates MCP tool calls into REST API requests to `POST /v1/risk-state` and returns the response. All computation (scoring, policy engine, data ingestion) happens server-side.

**This wrapper adds:**
- MCP protocol compliance (stdio transport for Claude Desktop/Code)
- Input validation via Zod schemas
- Human-readable policy summary prepended to responses
- Specific error messages (auth, rate limit, timeout) for agent recovery

**This wrapper does NOT:**
- Cache responses (the API has 60s server-side cache)
- Perform any scoring or computation locally
- Guarantee response schema stability (follows API versioning)

## Installation

```bash
npm install @riskstate/mcp-server
```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RISKSTATE_API_KEY` | Yes | API key from [riskstate.ai](https://riskstate.ai) (free during beta) |
| `RISKSTATE_API_URL` | No | Custom API base URL (default: `https://riskstate.netlify.app`) |

### Claude Desktop

Add to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "riskstate": {
      "command": "npx",
      "args": ["@riskstate/mcp-server"],
      "env": {
        "RISKSTATE_API_KEY": "your-api-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add riskstate -- npx @riskstate/mcp-server
```

Set the API key in your environment:

```bash
export RISKSTATE_API_KEY=your-api-key
```

## Usage

The server exposes one tool: `get_risk_policy`

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `asset` | `"BTC"` \| `"ETH"` | Yes | Asset to analyze |
| `wallet_address` | string | No | DeFi wallet for on-chain position data |
| `protocol` | `"spark"` \| `"aave"` | No | Lending protocol (default: spark) |
| `include_details` | boolean | No | Include full breakdown (subscores, macro, risk flags) |

### Example Response

```json
{
  "exposure_policy": {
    "policy_level": "CAUTIOUS",
    "max_size_pct": 35,
    "leverage_max": 1.5,
    "allowed_actions": ["DCA", "WAIT", "SPOT_LONG_CONFIRMED"],
    "blocked_actions": ["LEVERAGE_GT_2X", "NEW_POSITIONS_UNCONFIRMED"]
  },
  "classification": {
    "cycle_phase": "MID",
    "market_regime": "RANGE",
    "macro_regime": "NEUTRAL",
    "direction": "SIDEWAYS"
  },
  "auditability": {
    "composite_score": 52,
    "confidence_score": 0.72,
    "policy_hash": "a3f8c2...",
    "ttl_seconds": 60
  }
}
```

## How Agents Should Use This

Call `get_risk_policy` **before every trade**:

1. If `policy_level` starts with `BLOCK` → do not open new positions
2. Use `max_size_pct` to cap position sizing
3. Check `blocked_actions` before executing
4. Re-query after `ttl_seconds` (60s cache)

## Limitations

- **v1 scope:** BTC and ETH only. More assets planned.
- **Protocols:** Spark and Aave V3 only for DeFi position data.
- **Rate limit:** 60 requests/minute per API key.
- **Latency:** ~1-3s per request (9+ upstream data source aggregation).
- **Tested with:** Claude Desktop, Claude Code. Should work with any MCP-compatible client.

## Links

- **Landing page:** [riskstate.ai](https://riskstate.ai)
- **API docs:** [github.com/likidodefi/riskstate-docs](https://github.com/likidodefi/riskstate-docs)
- **SKILL.md:** [agentskills.io](https://agentskills.io)

## License

MIT