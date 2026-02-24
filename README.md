# tsdevstack

CLI tools and code generators for the tsdevstack full-stack TypeScript microservices framework. Scaffolds services, generates configs, and orchestrates local development.

## Features

- **Service scaffolding** — add NestJS backends, Next.js frontends, or Rsbuild SPAs with `add-service`
- **Config generation** — docker-compose, Kong gateway, secrets, and Dockerfiles from a single `sync` command
- **OpenAPI client generation** — type-safe HTTP clients from service OpenAPI specs
- **Plugin architecture** — infrastructure and cloud secrets are separate plugin packages
- **Multi-provider** — GCP, AWS, and Azure support

## Installation

```bash
npm install @tsdevstack/cli
```

## Commands

| Command | Description |
|---------|-------------|
| `init` | Create a new tsdevstack project |
| `sync` | Regenerate all local config (secrets, docker-compose, Kong) |
| `generate-secrets` | Generate local secrets files |
| `generate-kong` | Generate Kong gateway config from OpenAPI specs |
| `generate-docker-compose` | Generate docker-compose.yml |
| `generate-client <service>` | Generate TypeScript HTTP client from OpenAPI |
| `add-service <name> --type <type>` | Add a new service (nestjs, nextjs, spa) |
| `remove-service <name>` | Remove a service from the project |
| `register-detached-worker` | Register a background worker |
| `unregister-detached-worker` | Remove a worker registration |
| `validate-service` | Validate service structure and naming |

Infrastructure commands (`infra:deploy`, `cloud-secrets:push`, etc.) are provided by plugin packages `@tsdevstack/cli-infra` and `@tsdevstack/cli-cloud-secrets`.

## Plugin API

Plugins extend the CLI by importing the plugin context:

```typescript
import type { PluginContext } from '@tsdevstack/cli/plugin';

export function initContext(ctx: PluginContext): void {
  // Access logger, CliError, config utilities, etc.
}

export function registerPlugin(program: Command): void {
  program
    .command('my:command')
    .action(wrapCommand(async () => {
      // Plugin command implementation
    }));
}
```

The plugin context provides: `logger`, `CliError`, `wrapCommand`, `loadFrameworkConfig`, `isCIEnv`, cloud credential utilities, and shared types.

## Project Structure

```
src/
├── cli.ts              # Entry point, registers commands and plugins
├── commands/           # CLI command implementations
├── constants/          # Shared constants (one domain per file)
├── plugin/             # Plugin context and type exports
├── test-utils/         # Test helpers for plugins
└── utils/
    ├── add-service/    # Service scaffolding flows
    ├── ci/             # CI environment detection
    ├── cloud/          # Cloud provider utilities (GCP, AWS, Azure)
    ├── config/         # Framework config loading
    ├── credentials/    # Cloud credential management
    ├── docker/         # Docker compose and Dockerfile generators
    ├── environment/    # Environment utilities
    ├── errors/         # CliError, wrapCommand
    ├── exec/           # Shell command execution
    ├── fs/             # File system utilities
    ├── init/           # Project initialization
    ├── kong/           # Kong config generation from OpenAPI
    ├── logger/         # CLI logger with icons and colors
    ├── openapi/        # OpenAPI spec parsing and route extraction
    ├── paths/          # Path resolution
    ├── prisma/         # Database migration utilities
    ├── secrets/        # Local secrets generation
    ├── service/        # Service discovery and metadata
    ├── template/       # Template cloning and placeholder replacement
    ├── types/          # Shared type definitions
    └── validation/     # Input and credential validation
```

## License

MIT