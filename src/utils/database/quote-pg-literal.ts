/**
 * Quote a value as a Postgres string literal
 */

/**
 * Doubles single quotes and wraps the value in them. Postgres reads
 * backslashes in a plain literal as themselves (standard_conforming_strings,
 * on by default since 9.1).
 *
 * @param value - Any string
 * @returns 'value' with ' doubled
 */
export function quotePgLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
