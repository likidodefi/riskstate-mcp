# Contributing to riskstate-mcp

Thanks for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/riskstate-mcp.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b my-feature`

## Development

```bash
npm run build     # Compile TypeScript
npm run lint      # Run ESLint
npm test          # Run tests
```

## Submitting Changes

1. Ensure all checks pass: `npm run lint && npm test && npm run build`
2. Commit with a clear message describing the change
3. Push to your fork and open a Pull Request
4. Describe what your PR does and why

## Code Style

- TypeScript strict mode
- ESLint with `@typescript-eslint` rules
- No `any` types unless absolutely necessary

## Reporting Bugs

Open an issue at https://github.com/likidodefi/riskstate-mcp/issues with:
- Steps to reproduce
- Expected vs actual behavior
- Node.js version and OS
