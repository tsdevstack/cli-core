# tsdevstack

**Infrastructure as Framework** — the full-stack, cloud-native, AI-native TypeScript microservices framework.

From zero to production in an hour, not months.

You don't write Terraform. You don't configure gateways. You don't set up CI/CD. The framework generates, manages, and deploys all of it — across GCP, AWS, and Azure. You write application code, tsdevstack handles everything else.

NestJS backends, Next.js frontends, Rsbuild SPAs, Kong gateway, PostgreSQL, Redis, Prometheus, Grafana, Jaeger — with auto-generated infrastructure, secrets, and pipelines.

## Quick start

```bash
npx @tsdevstack/cli init
npx tsdevstack sync && npm run dev
```

This scaffolds a new project with services, gateway, database, and local dev environment ready to run.

## What it does

- **Infrastructure as Framework** — generated Terraform, Docker, gateway routes, and CI/CD from your service definitions. No YAML to maintain, no drift to debug.
- **Service scaffolding** — add NestJS backends, Next.js frontends, or Rsbuild SPAs with a single command
- **Multi-cloud deployment** — one command deploys to GCP, AWS, or Azure. Same framework, same patterns.
- **AI-native** — built-in MCP server for Claude Code, Cursor, and VS Code Copilot. 31 tools for deploying, querying, and debugging your stack.
- **Config generation** — docker-compose, Kong gateway, secrets, and Dockerfiles from a single `sync` command
- **OpenAPI client generation** — type-safe HTTP clients and DTOs from service specs
- **Secret management** — local generation and cloud secret sync with environment isolation
- **Observability** — Prometheus metrics, Grafana dashboards, distributed tracing with Jaeger
- **Authentication** — JWT token management, protected routes, session handling out of the box
- **Audit-ready** — SOC 2, ISO 27001, GDPR technical controls built in

## CLI Commands

### Local Development

| Command                   | Description                                           |
| ------------------------- | ----------------------------------------------------- |
| `sync`                    | Regenerate all config (Kong, docker-compose, secrets) |
| `add-service`             | Add a NestJS, Next.js, or SPA service                 |
| `remove-service`          | Remove a service from the project                     |
| `generate-kong`           | Regenerate Kong gateway config from OpenAPI specs     |
| `generate-secrets`        | Regenerate local secrets                              |
| `generate-docker-compose` | Regenerate docker-compose.yml                         |
| `generate-client`         | Generate TypeScript API client from OpenAPI spec      |
| `validate-service`        | Validate service naming and structure                 |

### Workers

| Command                      | Description                                         |
| ---------------------------- | --------------------------------------------------- |
| `register-detached-worker`   | Register a worker for separate container deployment |
| `unregister-detached-worker` | Remove a detached worker registration               |

### Cloud Secrets

| Command                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `cloud:init`           | Initialize cloud provider (GCP, AWS, or Azure) |
| `cloud-secrets:push`   | Push local secrets to cloud environment        |
| `cloud-secrets:diff`   | Compare local vs cloud secrets                 |
| `cloud-secrets:set`    | Set or update a cloud secret                   |
| `cloud-secrets:get`    | Get a secret value from cloud                  |
| `cloud-secrets:list`   | List all secrets in cloud environment          |
| `cloud-secrets:remove` | Remove a cloud secret                          |

### Infrastructure

| Command                 | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `infra:bootstrap`       | Bootstrap cloud project (enable APIs, add roles)         |
| `infra:init`            | Initialize infrastructure (Terraform state bucket)       |
| `infra:generate`        | Generate Terraform files from config                     |
| `infra:plan`            | Preview infrastructure changes                           |
| `infra:deploy`          | Full deploy: Terraform + services + Kong + load balancer |
| `infra:destroy`         | Destroy all infrastructure for an environment            |
| `infra:deploy-service`  | Build, push, and deploy a single service                 |
| `infra:deploy-services` | Build, push, and deploy all services                     |
| `infra:remove-service`  | Remove a service from cloud                              |
| `infra:deploy-kong`     | Deploy Kong gateway                                      |
| `infra:deploy-lb`       | Deploy load balancer                                     |
| `infra:deploy-env-auth` | Deploy environment access control                        |
| `infra:remove-env-auth` | Remove environment access control                        |
| `infra:status`          | Check infrastructure status                              |
| `infra:list-deployed`   | List all deployed services                               |
| `infra:service-status`  | Check status of a specific service                       |

### Database Migrations

| Command                 | Description                           |
| ----------------------- | ------------------------------------- |
| `infra:plan-db-migrate` | Show pending migrations for a service |
| `infra:run-db-migrate`  | Apply pending migrations              |

### Scheduled Jobs

| Command                   | Description                    |
| ------------------------- | ------------------------------ |
| `infra:deploy-scheduler`  | Deploy a single scheduled job  |
| `infra:deploy-schedulers` | Deploy all scheduled jobs      |
| `infra:list-schedulers`   | List scheduled jobs and status |
| `infra:remove-scheduler`  | Remove a scheduled job         |

### CI/CD

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `infra:init-ci`     | Initialize CI/CD (GitHub Actions) |
| `infra:generate-ci` | Regenerate CI workflows           |

All commands are run with `npx tsdevstack <command>` (or `npx tsds <command>`).

## Documentation

Full guides, tutorials, and API reference at **[tsdevstack.dev](https://tsdevstack.dev/)**

## License

MIT
