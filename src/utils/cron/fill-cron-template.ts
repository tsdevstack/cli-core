import { CliError } from '../errors';

/**
 * Fill a cron template's `{{PLACEHOLDER}}` marks. Every mark must have a
 * value: a template with an unknown mark is a CLI bug, not a user error.
 *
 * @param template - The template's text
 * @param values - A value per placeholder name
 */
export function fillCronTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (mark, key: string) => {
    if (!(key in values)) {
      throw new CliError(
        `Cron template has an unknown placeholder: ${mark}`,
        'register-cron',
        'This is a bug in the CLI templates, not in your project',
      );
    }
    return values[key];
  });
}
