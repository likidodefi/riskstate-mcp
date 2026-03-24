# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-03-24

### Fixed

- `npx` binary resolution: added `riskstate-mcp` as the primary bin name. Use `npx -p @riskstate/mcp-server riskstate-mcp` for npx, or `npm install -g @riskstate/mcp-server` then `riskstate-mcp` for global install.

## [1.0.0] - 2026-03-22

### Added

- Initial release: MCP server wrapping the RiskState `/v1/risk-state` API
- One tool: `get_risk_policy` — returns policy level, max position size, leverage limits, allowed/blocked actions
- Support for BTC and ETH assets
- Optional DeFi wallet integration (Spark Protocol, Aave V3)
- Human-readable summary prepended to JSON response for quick agent parsing
- Error handling for auth failures, rate limits, timeouts, and server errors
- Claude Desktop and Claude Code integration via `npx -p @riskstate/mcp-server riskstate-mcp`
- Dockerfile for containerized deployment
- MIT License
