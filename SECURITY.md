# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in riskstate-mcp, please report it responsibly:

1. **Do NOT open a public GitHub issue** for security vulnerabilities
2. Email **security@riskstate.ai** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive a response within 48 hours
4. We will work with you to understand and address the issue before any public disclosure

## Scope

This MCP server is a thin API client. It:
- Does **not** store API keys on disk (reads from environment variables only)
- Does **not** execute trades or modify blockchain state
- Does **not** cache or persist any data
- Communicates only with `riskstate.netlify.app` (configurable via `RISKSTATE_API_URL`)

Security concerns related to the RiskState API itself should be reported to the same email address.
