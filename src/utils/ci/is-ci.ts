/**
 * Check if running in CI environment
 *
 * GitHub Actions and most CI platforms automatically set CI=true.
 */
export function isCIEnv(): boolean {
  return process.env.CI === 'true';
}