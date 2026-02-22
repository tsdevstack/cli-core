/**
 * Add Service Command
 *
 * Interactive command to scaffold new apps:
 * - SPA (rsbuild): React, Vue, Solid, Svelte, Vanilla
 * - Next.js: Full-stack frontend with standalone output
 * - Next.js with Auth: Full auth flow (cloned from template)
 * - NestJS: Backend service with optional database
 *
 * Usage:
 *   npx tsdevstack add-service
 *   npx tsdevstack add-service --name my-app --type spa
 */

import inquirer from 'inquirer';
import { logger } from '../utils/logger';
import { loadFrameworkConfig } from '../utils/config';
import { validateServiceNameAvailable } from '../utils/validation';
import { validateServiceName } from '../utils/validation/validate-service-name';
import { getNextPort } from '../utils/add-service/get-next-port';
import { spaFlow } from '../utils/add-service/flows/spa-flow';
import { nextjsFlow } from '../utils/add-service/flows/nextjs-flow';
import { nextjsAuthFlow } from '../utils/add-service/flows/nextjs-auth-flow';
import { nestjsFlow } from '../utils/add-service/flows/nestjs-flow';

export type ServiceType = 'spa' | 'nextjs' | 'nextjs-auth' | 'nestjs';

export interface AddServiceOptions {
  name?: string;
  type?: ServiceType;
}

const SERVICE_TYPE_CHOICES = [
  {
    name: 'SPA (Single Page App) - React, Vue, Solid, Svelte, or Vanilla',
    value: 'spa',
  },
  {
    name: 'Next.js - Full-stack React framework',
    value: 'nextjs',
  },
  {
    name: 'Next.js with Auth - Full auth flow (requires auth-service)',
    value: 'nextjs-auth',
  },
  {
    name: 'NestJS - Backend service (must end with -service)',
    value: 'nestjs',
  },
];

export async function addService(options: AddServiceOptions): Promise<void> {
  logger.newline();
  logger.info('Add new service to your project');
  logger.newline();

  // Load config
  const config = loadFrameworkConfig();
  const port = getNextPort(config);

  // Step 1: Select service type
  let serviceType = options.type;
  if (!serviceType) {
    const typeAnswer = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Select app type:',
        choices: SERVICE_TYPE_CHOICES,
      },
    ]);
    serviceType = typeAnswer.type as ServiceType;
  }

  // Warn if Next.js with Auth is selected but no auth-service exists
  if (serviceType === 'nextjs-auth') {
    const hasAuthService = config.services.some((s) =>
      s.name.includes('auth-service'),
    );
    if (!hasAuthService) {
      logger.warn(
        'No auth-service found in your project. The Next.js auth template requires an auth-service to function.',
      );
    }
  }

  // Step 2: Get service name
  let serviceName = options.name;
  if (!serviceName) {
    const namePrompt =
      serviceType === 'nestjs'
        ? 'Service name (must end with -service):'
        : 'App name:';

    const nameAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: namePrompt,
        validate: (input: string) => {
          try {
            // Basic validation first
            validateServiceName(input);

            // For NestJS, must end with -service
            if (serviceType === 'nestjs' && !input.endsWith('-service')) {
              return 'NestJS service names must end with -service (e.g., order-service)';
            }

            // Check availability
            validateServiceNameAvailable(input);
            return true;
          } catch (error) {
            if (error instanceof Error) {
              return error.message;
            }
            return 'Invalid service name';
          }
        },
      },
    ]);
    serviceName = nameAnswer.name;
  } else {
    // Validate provided name
    validateServiceName(serviceName);
    if (serviceType === 'nestjs' && !serviceName.endsWith('-service')) {
      throw new Error('NestJS service names must end with -service');
    }
    validateServiceNameAvailable(serviceName);
  }

  // At this point serviceName is guaranteed to be defined
  const name = serviceName as string;

  logger.newline();
  logger.info(`Creating ${serviceType} app: ${name}`);
  logger.info(`Port: ${port}`);
  logger.newline();

  // Step 3: Run type-specific flow
  switch (serviceType) {
    case 'spa':
      await spaFlow(name, port, config);
      break;
    case 'nextjs':
      await nextjsFlow(name, port, config);
      break;
    case 'nextjs-auth':
      await nextjsAuthFlow(name, port, config);
      break;
    case 'nestjs':
      await nestjsFlow(name, port, config);
      break;
  }
}
