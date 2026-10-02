/**
 * Escape a literal path fragment for a Kong regex route
 */

/** Characters with a meaning in Kong's regex router (Rust regex syntax) */
const REGEX_SPECIAL_CHARACTERS = /[\\.^$|?*+()[\]{}]/g;

/**
 * Escapes every regex special character (`\ . ^ $ | ? * + ( ) [ ] { }`) so
 * the fragment matches itself literally, e.g. `v2.1` becomes `v2\.1`.
 *
 * @param literal - Literal path fragment (no parameters)
 * @returns The escaped fragment
 */
export function escapeKongRegexLiteral(literal: string): string {
  return literal.replace(REGEX_SPECIAL_CHARACTERS, '\\$&');
}
