/**
 * Prompt for init command options
 *
 * Gathers project name, template, frontend name, and cloud provider
 * via interactive prompts when not provided as CLI args.
 *
 * @param args - CLI arguments (partial, missing fields are prompted)
 * @returns Complete InitOptions with all fields resolved
 */

import inquirer from 'inquirer';
import { validateServiceName } from '../validation/validate-service-name';

export type InitTemplate = 'empty' | 'auth' | 'fullstack-auth';

export interface InitCliArgs {
  name?: string;
  template?: string;
  frontendName?: string;
}

export interface InitOptions {
  projectName: string;
  template: InitTemplate;
  frontendName: string | null;
}

const TEMPLATE_CHOICES = [
  {
    name: 'Empty (add services later)',
    value: 'empty',
  },
  {
    name: 'Auth backend (NestJS auth-service)',
    value: 'auth',
  },
  {
    name: 'Full-stack auth (auth-service + Next.js frontend)',
    value: 'fullstack-auth',
  },
];

const VALID_TEMPLATES: ReadonlySet<string> = new Set([
  'empty',
  'auth',
  'fullstack-auth',
]);

/**
 * Validate a name used for inquirer prompt validation
 * Returns true or an error message string
 */
function validateName(input: string): true | string {
  try {
    validateServiceName(input);
    return true;
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Invalid name';
  }
}

export async function promptInitOptions(
  args: InitCliArgs,
): Promise<InitOptions> {
  // Project name
  let projectName = args.name;
  if (!projectName) {
    const answer = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        validate: validateName,
      },
    ]);
    projectName = answer.name as string;
  } else {
    validateServiceName(projectName);
  }

  // Template
  let template: InitTemplate;
  if (args.template && VALID_TEMPLATES.has(args.template)) {
    template = args.template as InitTemplate;
  } else {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Template:',
        choices: TEMPLATE_CHOICES,
      },
    ]);
    template = answer.template as InitTemplate;
  }

  // Frontend name (only for fullstack-auth)
  let frontendName: string | null = null;
  if (template === 'fullstack-auth') {
    if (args.frontendName) {
      validateServiceName(args.frontendName);
      frontendName = args.frontendName;
    } else {
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'frontendName',
          message: 'Frontend app name:',
          default: 'frontend',
          validate: validateName,
        },
      ]);
      frontendName = answer.frontendName as string;
    }
  }

  return {
    projectName,
    template,
    frontendName,
  };
}
