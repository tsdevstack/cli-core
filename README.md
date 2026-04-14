# tsdevstack

**Infrastructure as Framework** for TypeScript microservices.

One config file. Three cloud providers. Production-grade infrastructure — generated, not hand-written.

```bash
npx @tsdevstack/cli init
```

## What you get

tsdevstack scaffolds a full-stack TypeScript monorepo and generates all the infrastructure around it:

**Application layer** — NestJS backends, Next.js frontends, Rsbuild SPAs. Auto-generated TypeScript API clients with DTOs as separated imports — both frontend and backend apps consume the same type-safe library.

**API gateway** — Kong routes auto-generated from your OpenAPI specs. JWT validation, rate limiting, CORS, bot detection — configured, not coded. Fully customizable when you need it, or bring your own Kong config.

**Background processing** — BullMQ job queues with detached workers running in separate containers. Register, deploy, and scale workers independently from your API services.

**Object storage** — Add buckets with `add-bucket-storage`. MinIO locally, S3/GCS/Azure Blob in production. Unified `StorageModule` with presigned URLs, streaming, and per-provider adapters.

**Async messaging** — Inter-service pub/sub via Redis Streams. Consumer groups, dead letter queues, retry logic. No new infrastructure — runs on the same Redis instance as caching and BullMQ.

**Authentication** — OWASP-aligned JWT token management, protected routes, session handling, email confirmation. Bring your own OIDC or use the built-in auth service template.

**Secrets** — Generated locally, synced to cloud. Environment isolation, scoped per service, rotated on deploy. Secret Manager on all three providers.

**Observability** — Prometheus metrics, Grafana dashboards, distributed tracing with Jaeger, structured logging. Configured from day one.

**Infrastructure** — Generated Terraform for GCP, AWS, and Azure. VPC/VNet, managed databases, Redis, container orchestration, load balancers, WAF, SSL, CDN. One command to deploy.

**CI/CD** — Generated GitHub Actions workflows. OIDC authentication, per-service deploys, environment selection. No secrets in your repo.

**Compliance** — SOC 2, ISO 27001, GDPR technical controls built into the generated infrastructure. OWASP Top 10 coverage. Encryption at rest and in transit, network isolation, zero-credential runtimes.

## Quick start

```bash
# Scaffold a new project
npx @tsdevstack/cli init

# Start local development
npx tsdevstack sync
npm run dev

# Deploy to cloud
npx tsdevstack cloud:init --gcp    # or --aws, --azure
npx tsdevstack infra:init --env dev
npx tsdevstack infra:deploy --env dev
```

## CLI reference

### Project setup

| Command            | Description                                           |
| ------------------ | ----------------------------------------------------- |
| `init`             | Scaffold a new tsdevstack project                     |
| `sync`             | Regenerate all config (Kong, docker-compose, secrets) |
| `add-service`      | Add a NestJS, Next.js, or SPA service                 |
| `remove-service`   | Remove a service from the project                     |
| `validate-service` | Validate service naming and structure                 |

### Storage & messaging

| Command                  | Description                                            |
| ------------------------ | ------------------------------------------------------ |
| `add-bucket-storage`     | Add an object storage bucket                           |
| `remove-bucket-storage`  | Remove a storage bucket                                |
| `add-messaging-topic`    | Add a pub/sub messaging topic                          |
| `remove-messaging-topic` | Remove a messaging topic                               |
| `update-messaging-topic` | Update publishers/subscribers (replaces the full list) |

### Workers

| Command                      | Description                                                |
| ---------------------------- | ---------------------------------------------------------- |
| `register-detached-worker`   | Register a BullMQ worker for separate container deployment |
| `unregister-detached-worker` | Remove a detached worker registration                      |

### Code generation

| Command                   | Description                                       |
| ------------------------- | ------------------------------------------------- |
| `generate-kong`           | Regenerate Kong gateway config from OpenAPI specs |
| `generate-secrets`        | Regenerate local secrets                          |
| `generate-docker-compose` | Regenerate docker-compose.yml                     |
| `generate-client`         | Generate TypeScript API client from OpenAPI spec  |

### Cloud secrets

| Command                | Description                           |
| ---------------------- | ------------------------------------- |
| `cloud:init`           | Initialize cloud provider credentials |
| `cloud-secrets:push`   | Push local secrets to cloud           |
| `cloud-secrets:diff`   | Compare local vs cloud secrets        |
| `cloud-secrets:set`    | Set or update a cloud secret          |
| `cloud-secrets:get`    | Retrieve a secret value               |
| `cloud-secrets:list`   | List all secrets in an environment    |
| `cloud-secrets:remove` | Remove a cloud secret                 |

### Infrastructure

| Command               | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `infra:bootstrap`     | Enable APIs and add IAM roles                          |
| `infra:init`          | Create Terraform state bucket                          |
| `infra:generate`      | Generate Terraform files from config                   |
| `infra:plan`          | Preview infrastructure changes                         |
| `infra:deploy`        | Full deploy — Terraform, services, Kong, load balancer |
| `infra:destroy`       | Tear down all infrastructure for an environment        |
| `infra:status`        | Check infrastructure status                            |
| `infra:list-deployed` | List deployed services with versions                   |

### Service deployment

| Command                        | Description                              |
| ------------------------------ | ---------------------------------------- |
| `infra:deploy-service`         | Build, push, and deploy a single service |
| `infra:deploy-services`        | Deploy all services                      |
| `infra:remove-service`         | Remove a service from cloud              |
| `infra:remove-detached-worker` | Remove a worker from cloud               |
| `infra:generate-docker`        | Generate Dockerfiles                     |
| `infra:build-docker`           | Build Docker images                      |
| `infra:push-docker`            | Push images to registry                  |

### Gateway & load balancer

| Command               | Description             |
| --------------------- | ----------------------- |
| `infra:generate-kong` | Generate Kong config    |
| `infra:build-kong`    | Build Kong Docker image |
| `infra:deploy-kong`   | Deploy Kong gateway     |
| `infra:deploy-lb`     | Deploy load balancer    |

### Database

Migrations run automatically as part of service deployment. These commands are for manual inspection and ad-hoc runs.

| Command                 | Description              |
| ----------------------- | ------------------------ |
| `infra:plan-db-migrate` | Show pending migrations  |
| `infra:run-db-migrate`  | Apply pending migrations |

### Scheduled jobs

| Command                   | Description               |
| ------------------------- | ------------------------- |
| `infra:deploy-scheduler`  | Deploy a scheduled job    |
| `infra:deploy-schedulers` | Deploy all scheduled jobs |
| `infra:list-schedulers`   | List jobs and status      |
| `infra:remove-scheduler`  | Remove a scheduled job    |

### CI/CD

| Command             | Description                     |
| ------------------- | ------------------------------- |
| `infra:init-ci`     | Initialize GitHub Actions CI/CD |
| `infra:generate-ci` | Regenerate CI workflows         |

All commands: `npx tsdevstack <command>` or `npx tsds <command>`.

## Packages

| Package                                                                                            | Description                                                              |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [`@tsdevstack/cli`](https://www.npmjs.com/package/@tsdevstack/cli)                                 | CLI — project scaffolding, infrastructure generation, deployment         |
| [`@tsdevstack/nest-common`](https://www.npmjs.com/package/@tsdevstack/nest-common)                 | Shared NestJS modules — auth, secrets, storage, messaging, observability |
| [`@tsdevstack/cli-mcp`](https://www.npmjs.com/package/@tsdevstack/cli-mcp)                         | MCP server — AI agent integration with 54 tools                          |
| [`@tsdevstack/react-bot-detection`](https://www.npmjs.com/package/@tsdevstack/react-bot-detection) | React bot detection — behavioral analysis + honeypot                     |

## Documentation

Guides, architecture, and API reference at **[tsdevstack.dev](https://tsdevstack.dev)**

## Community

Join the Discord: [discord.gg/2EMFkqc8QR](https://discord.gg/2EMFkqc8QR)

## License

MIT
