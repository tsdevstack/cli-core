# tsdevstack

Full-stack, cloud-native TypeScript microservices framework. From zero to production in an hour, not months.

NestJS backends, Next.js frontends, Kong gateway, PostgreSQL, Redis — with auto-generated infrastructure for GCP, AWS, and Azure.

## Quick start

```bash
npm install @tsdevstack/cli
npx tsdevstack init
```

This scaffolds a new project with services, gateway, database, and local dev environment ready to run.

## What it does

- **Service scaffolding** — add NestJS backends, Next.js frontends, or Rsbuild SPAs
- **Config generation** — docker-compose, Kong gateway, secrets, and Dockerfiles from a single `sync` command
- **OpenAPI client generation** — type-safe HTTP clients from service specs
- **Cloud deployment** — Terraform, Docker builds, and deploys across GCP, AWS, and Azure
- **Secret management** — local generation and cloud secret sync
- **AI integration** — built-in MCP server for Claude Code, Cursor, and VS Code Copilot

## Documentation

Full guides, tutorials, and API reference at **[tsdevstack.dev](https://tsdevstack.dev/)**

## License

MIT