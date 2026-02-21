/**
 * Shared mock context creator for plugin tests
 *
 * Used by plugin __mocks__/context.ts files
 */

import { rs } from '@rstest/core';

/**
 * Create all mock functions for the plugin context
 */
export function createMockContext() {
  const logger = {
    info: rs.fn(),
    error: rs.fn(),
    warn: rs.fn(),
    success: rs.fn(),
    debug: rs.fn(),
    newline: rs.fn(),
    generating: rs.fn(),
    reading: rs.fn(),
    loading: rs.fn(),
    checking: rs.fn(),
    running: rs.fn(),
    creating: rs.fn(),
    updating: rs.fn(),
    syncing: rs.fn(),
    validating: rs.fn(),
    building: rs.fn(),
    complete: rs.fn(),
    summary: rs.fn(),
    ready: rs.fn(),
  };

  class CliError extends Error {
    constructor(
      message: string,
      public context?: string,
      public hint?: string,
    ) {
      super(message);
      this.name = 'CliError';
    }
  }

  return {
    logger,
    findProjectRoot: rs.fn(),
    getConfigPath: rs.fn(),
    loadFrameworkConfig: rs.fn(),
    readJsonFile: rs.fn(),
    writeJsonFile: rs.fn(),
    isFile: rs.fn(),
    ensureDirectory: rs.fn(),
    writeTextFile: rs.fn(),
    loadCredentialsFile: rs.fn(),
    validateDuplicateCredentials: rs.fn(),
    getAvailableEnvironments: rs.fn(() => ['dev', 'staging', 'prod']),
    generateFrameworkSecretsFile: rs.fn(),
    loadUserSecrets: rs.fn(),
    loadFrameworkSecrets: rs.fn(),
    generateServiceUrls: rs.fn(),
    getCredentialsPath: rs.fn(),
    isCIEnv: rs.fn(() => false),
    buildGCPClientOptions: rs.fn(() => ({ credentials: {} })),
    CliError,
    wrapCommand: rs.fn(
      <T extends unknown[]>(fn: (...args: T) => Promise<void>) => fn,
    ),
    TSDEVSTACK_DIR: '.tsdevstack',
    SECRET_MAP_FILENAME: 'secret-map.json',
    executeCommand: rs.fn(() => ''),
    CLOUD_PROVIDERS: ['gcp', 'aws', 'azure'] as const,
  };
}

export type MockContext = ReturnType<typeof createMockContext>;
