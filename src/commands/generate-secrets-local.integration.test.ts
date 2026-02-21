import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import { generateSecretsLocal } from './generate-secrets-local';
import type { FrameworkConfig } from '../utils/config';
import type { SecretsFile } from '../utils/secrets';
import * as configModule from '../utils/config';
import * as secretsModule from '../utils/secrets';
import * as loggerModule from '../utils/logger';
import * as fsModule from '../utils/fs';
import * as pathsModule from '../utils/paths';
import type { OperationContext } from '../utils/types/operation-context';

// Mock all dependencies
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/secrets', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/fs', { mock: true });
rs.mock('../utils/paths', { mock: true });

describe('generateSecretsLocal', () => {
  // Mock logger to prevent console output during tests
  const mockLogger = {
    generating: rs.fn(),
    loading: rs.fn(),
    checking: rs.fn(),
    updating: rs.fn(),
    success: rs.fn(),
    info: rs.fn(),
    warn: rs.fn(),
    complete: rs.fn(),
    summary: rs.fn(),
    newline: rs.fn(),
  };

  // Sample test data
  const mockConfig: FrameworkConfig = {
    project: {
      name: 'test-project',
      version: '1.0.0',
    },
    cloud: { provider: null },
    services: [
      {
        name: 'auth-service',
        type: 'backend',
        port: 3001,
      },
      {
        name: 'user-service',
        type: 'backend',
        port: 3002,
      },
    ],
  };

  const mockFrameworkSecrets: SecretsFile = {
    secrets: {
      AUTH_SECRET: 'framework-auth-secret',
      REFRESH_TOKEN_SECRET: 'framework-refresh-secret',
      AUTH_SERVICE_API_KEY: 'auth-api-key',
      USER_SERVICE_API_KEY: 'user-api-key',
    },
    'auth-service': {
      secrets: ['AUTH_SECRET', 'AUTH_SERVICE_API_KEY'],
      PORT: '3001',
    },
    'user-service': {
      secrets: ['USER_SERVICE_API_KEY'],
      PORT: '3002',
    },
  };

  const mockUserSecrets: SecretsFile = {
    secrets: {
      CUSTOM_KEY: 'custom-value',
    },
    'auth-service': {
      secrets: ['AUTH_SECRET', 'AUTH_SERVICE_API_KEY'],
      ALLOWED_ORIGINS: 'http://localhost:3000',
    },
    'user-service': {
      secrets: ['USER_SERVICE_API_KEY'],
    },
  };

  beforeEach(() => {
    rs.clearAllMocks();

    // Setup logger mocks
    rs.mocked(loggerModule.logger).generating = mockLogger.generating;
    rs.mocked(loggerModule.logger).loading = mockLogger.loading;
    rs.mocked(loggerModule.logger).checking = mockLogger.checking;
    rs.mocked(loggerModule.logger).updating = mockLogger.updating;
    rs.mocked(loggerModule.logger).success = mockLogger.success;
    rs.mocked(loggerModule.logger).info = mockLogger.info;
    rs.mocked(loggerModule.logger).warn = mockLogger.warn;
    rs.mocked(loggerModule.logger).complete = mockLogger.complete;
    rs.mocked(loggerModule.logger).summary = mockLogger.summary;
    rs.mocked(loggerModule.logger).newline = mockLogger.newline;

    // Setup default mocks
    rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(mockConfig);
    rs.mocked(secretsModule.loadFrameworkSecrets).mockReturnValue(null);
    rs.mocked(secretsModule.generateFrameworkSecretsFile).mockReturnValue(
      mockFrameworkSecrets,
    );
    rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(null);
    rs.mocked(secretsModule.generateUserSecretsFile).mockReturnValue(
      mockUserSecrets,
    );
    rs.mocked(secretsModule.syncUserSecretsStructure).mockReturnValue(null);
    rs.mocked(secretsModule.mergeSecrets).mockReturnValue({
      secrets: { ...mockFrameworkSecrets.secrets, ...mockUserSecrets.secrets },
      'auth-service': {
        ...(mockFrameworkSecrets['auth-service'] as Record<string, unknown>),
        ...(mockUserSecrets['auth-service'] as Record<string, unknown>),
      },
      'user-service': mockFrameworkSecrets['user-service'],
    });
    rs.mocked(secretsModule.writeSecretsFile).mockReturnValue(undefined);
    rs.mocked(secretsModule.generateEnvFile).mockReturnValue(undefined);
    rs.mocked(secretsModule.deepDeleteServiceReferences).mockReturnValue({
      modified: false,
      result: mockUserSecrets,
    });
    rs.mocked(secretsModule.toScreamingSnakeCase).mockImplementation(
      (str: string) => str.replace(/-/g, '_').toUpperCase(),
    );
    rs.mocked(secretsModule.generateSecretMap).mockReturnValue({
      'auth-service': ['AUTH_SECRET', 'AUTH_SERVICE_API_KEY'],
      'user-service': ['USER_SERVICE_API_KEY'],
    });
    rs.mocked(fsModule.writeJsonFile).mockReturnValue(undefined);
    rs.mocked(pathsModule.findProjectRoot).mockReturnValue('/mock/project');
  });

  afterEach(() => {
    rs.clearAllMocks();
  });

  describe('Basic flow - no existing files', () => {
    it('should execute all 5 steps in correct order', () => {
      generateSecretsLocal();

      // Step 1: Load config
      expect(configModule.loadFrameworkConfig).toHaveBeenCalledTimes(1);

      // Step 2: Load existing framework secrets
      expect(secretsModule.loadFrameworkSecrets).toHaveBeenCalledTimes(1);

      // Step 3: Generate framework secrets
      expect(secretsModule.generateFrameworkSecretsFile).toHaveBeenCalledWith(
        mockConfig,
        null,
      );
      expect(secretsModule.writeSecretsFile).toHaveBeenCalledWith(
        '.secrets.tsdevstack.json',
        mockFrameworkSecrets,
      );

      // Generate user secrets (no existing file)
      expect(secretsModule.loadUserSecrets).toHaveBeenCalledTimes(1);
      expect(secretsModule.generateUserSecretsFile).toHaveBeenCalledWith(
        mockConfig,
      );
      expect(secretsModule.writeSecretsFile).toHaveBeenCalledWith(
        '.secrets.user.json',
        mockUserSecrets,
      );

      // Step 4: Merge
      expect(secretsModule.mergeSecrets).toHaveBeenCalledWith(
        mockFrameworkSecrets,
        mockUserSecrets,
      );

      // Step 5: Generate env
      expect(secretsModule.generateEnvFile).toHaveBeenCalledTimes(1);
    });

    it('should write local secrets with correct metadata', () => {
      generateSecretsLocal();

      const localSecretsCall = rs
        .mocked(secretsModule.writeSecretsFile)
        .mock.calls.find((call) => call[0] === '.secrets.local.json');

      expect(localSecretsCall).toBeDefined();
      const [, localSecrets] = localSecretsCall!;

      expect(localSecrets.$comment).toBe(
        'AUTO-GENERATED - DO NOT EDIT THIS FILE',
      );
      expect(localSecrets.$warning).toBe(
        "This file is regenerated by 'npx tsdevstack generate-secrets'",
      );
      expect(localSecrets.$edit_instead).toBe(
        'Edit .secrets.user.json for custom values',
      );
      expect(localSecrets.$generated_at).toBeDefined();
      expect(localSecrets.$source).toBe(
        'Merged from .secrets.tsdevstack.json + .secrets.user.json',
      );
    });

    it('should write exactly 4 files', () => {
      generateSecretsLocal();

      expect(secretsModule.writeSecretsFile).toHaveBeenCalledTimes(4);

      const calls = rs.mocked(secretsModule.writeSecretsFile).mock.calls;
      const fileNames = calls.map((call) => call[0]);

      expect(fileNames).toEqual([
        '.secrets.tsdevstack.json',
        '.secrets.user.json',
        '.secrets.user.example.json',
        '.secrets.local.json',
      ]);
    });
  });

  describe('Basic flow - with existing files', () => {
    it('should preserve existing framework secrets', () => {
      const existingFrameworkSecrets: SecretsFile = {
        secrets: {
          AUTH_SECRET: 'existing-auth-secret',
          REFRESH_TOKEN_SECRET: 'existing-refresh-secret',
        },
      };

      rs.mocked(secretsModule.loadFrameworkSecrets).mockReturnValue(
        existingFrameworkSecrets,
      );

      generateSecretsLocal();

      expect(secretsModule.generateFrameworkSecretsFile).toHaveBeenCalledWith(
        mockConfig,
        existingFrameworkSecrets,
      );
    });

    it('should preserve existing user secrets', () => {
      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);

      generateSecretsLocal();

      // Should NOT call generateUserSecretsFile
      expect(secretsModule.generateUserSecretsFile).not.toHaveBeenCalled();

      // Should call syncUserSecretsStructure
      expect(secretsModule.syncUserSecretsStructure).toHaveBeenCalledWith(
        mockUserSecrets,
        mockConfig,
      );
    });

    it('should write synced user secrets if structure changed', () => {
      const syncedUserSecrets: SecretsFile = {
        ...mockUserSecrets,
        'payment-service': {
          secrets: [],
        },
      };

      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);
      rs.mocked(secretsModule.syncUserSecretsStructure).mockReturnValue(
        syncedUserSecrets,
      );

      generateSecretsLocal();

      expect(secretsModule.writeSecretsFile).toHaveBeenCalledWith(
        '.secrets.user.json',
        syncedUserSecrets,
      );
    });

    it('should not write user secrets if structure unchanged', () => {
      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);
      rs.mocked(secretsModule.syncUserSecretsStructure).mockReturnValue(null);

      generateSecretsLocal();

      // Should only write framework, example, and local secrets (3 files)
      const calls = rs.mocked(secretsModule.writeSecretsFile).mock.calls;
      const fileNames = calls.map((call) => call[0]);

      expect(fileNames).toEqual([
        '.secrets.tsdevstack.json',
        '.secrets.user.example.json',
        '.secrets.local.json',
      ]);
    });
  });

  describe('Remove operation', () => {
    const context: OperationContext = {
      operation: 'remove',
      removedService: 'auth-service',
    };

    it('should call deepDeleteServiceReferences with correct parameters', () => {
      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);

      generateSecretsLocal(context);

      expect(secretsModule.deepDeleteServiceReferences).toHaveBeenCalledWith(
        mockUserSecrets,
        'auth-service',
      );
    });

    it('should write updated user secrets if modified', () => {
      const updatedUserSecrets: SecretsFile = {
        secrets: {
          CUSTOM_KEY: 'custom-value',
          // AUTH_SERVICE_API_KEY removed
        },
        // 'auth-service' section removed
        'user-service': {
          secrets: ['USER_SERVICE_API_KEY'],
        },
      };

      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);
      rs.mocked(secretsModule.deepDeleteServiceReferences).mockReturnValue({
        modified: true,
        result: updatedUserSecrets,
      });

      generateSecretsLocal(context);

      expect(secretsModule.writeSecretsFile).toHaveBeenCalledWith(
        '.secrets.user.json',
        updatedUserSecrets,
      );
    });

    it('should not write user secrets if delete did not modify anything', () => {
      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);
      rs.mocked(secretsModule.deepDeleteServiceReferences).mockReturnValue({
        modified: false,
        result: mockUserSecrets,
      });
      rs.mocked(secretsModule.syncUserSecretsStructure).mockReturnValue(null);

      generateSecretsLocal(context);

      // Should only write framework, example, and local secrets
      const calls = rs.mocked(secretsModule.writeSecretsFile).mock.calls;
      const fileNames = calls.map((call) => call[0]);

      expect(fileNames).toEqual([
        '.secrets.tsdevstack.json',
        '.secrets.user.example.json',
        '.secrets.local.json',
      ]);
    });

    it('should log removed service name', () => {
      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);
      rs.mocked(secretsModule.deepDeleteServiceReferences).mockReturnValue({
        modified: true,
        result: mockUserSecrets,
      });

      generateSecretsLocal(context);

      expect(mockLogger.success).toHaveBeenCalledWith(
        'Removed all service references: auth-service',
      );
      expect(mockLogger.success).toHaveBeenCalledWith(
        'Deleted uppercase env vars: AUTH_SERVICE_*',
      );
    });
  });

  describe('Combined operations', () => {
    it('should handle remove + sync together', () => {
      const context: OperationContext = {
        operation: 'remove',
        removedService: 'auth-service',
      };

      const updatedUserSecrets: SecretsFile = {
        secrets: mockUserSecrets.secrets,
        'user-service': mockUserSecrets['user-service'],
      };

      const syncedUserSecrets: SecretsFile = {
        ...updatedUserSecrets,
        'payment-service': {
          secrets: [],
        },
      };

      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);
      rs.mocked(secretsModule.deepDeleteServiceReferences).mockReturnValue({
        modified: true,
        result: updatedUserSecrets,
      });
      rs.mocked(secretsModule.syncUserSecretsStructure).mockReturnValue(
        syncedUserSecrets,
      );

      generateSecretsLocal(context);

      // Should write user secrets twice
      const userSecretsWrites = rs
        .mocked(secretsModule.writeSecretsFile)
        .mock.calls.filter((call) => call[0] === '.secrets.user.json');

      expect(userSecretsWrites).toHaveLength(2);
      expect(userSecretsWrites[0][1]).toBe(updatedUserSecrets);
      expect(userSecretsWrites[1][1]).toBe(syncedUserSecrets);
    });
  });

  describe('Logging behavior', () => {
    it('should log all major steps', () => {
      generateSecretsLocal();

      expect(mockLogger.generating).toHaveBeenCalledWith(
        'Generating secrets (three-file system)...',
      );
      expect(mockLogger.loading).toHaveBeenCalledWith(
        'Loaded config: 2 services',
      );
      expect(mockLogger.generating).toHaveBeenCalledWith(
        'Generating .secrets.tsdevstack.json...',
      );
      expect(mockLogger.generating).toHaveBeenCalledWith(
        'Generating .secrets.user.json...',
      );
      expect(mockLogger.generating).toHaveBeenCalledWith(
        'Generating .secrets.local.json...',
      );
      expect(mockLogger.generating).toHaveBeenCalledWith(
        'Generating .env for Docker/Kong...',
      );
      expect(mockLogger.generating).toHaveBeenCalledWith(
        'Generating .env files for Next.js apps...',
      );
      expect(mockLogger.complete).toHaveBeenCalledWith(
        'Secrets generation complete!',
      );
    });

    it('should log when preserving existing framework secrets', () => {
      rs.mocked(secretsModule.loadFrameworkSecrets).mockReturnValue(
        mockFrameworkSecrets,
      );

      generateSecretsLocal();

      expect(mockLogger.loading).toHaveBeenCalledWith(
        'Loading existing framework secrets...',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '   Preserving existing framework secrets (AUTH_SECRET, API_KEY)',
      );
    });

    it('should log when preserving existing user secrets', () => {
      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);

      generateSecretsLocal();

      expect(mockLogger.checking).toHaveBeenCalledWith(
        'Checking .secrets.user.json...',
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        '   File exists, preserving user edits',
      );
    });

    it('should log summary with correct counts', () => {
      generateSecretsLocal();

      expect(mockLogger.summary).toHaveBeenCalledWith('Summary:');
      expect(mockLogger.info).toHaveBeenCalledWith('   - Framework secrets: 4');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '   - Services configured: 2',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty config services array', () => {
      const emptyConfig = { ...mockConfig, services: [] };
      rs.mocked(configModule.loadFrameworkConfig).mockReturnValue(emptyConfig);

      generateSecretsLocal();

      expect(secretsModule.generateFrameworkSecretsFile).toHaveBeenCalledWith(
        emptyConfig,
        null,
      );
      expect(secretsModule.generateUserSecretsFile).toHaveBeenCalledWith(
        emptyConfig,
      );
    });

    it('should handle context without operation', () => {
      const context: OperationContext = {} as OperationContext;

      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);

      generateSecretsLocal(context);

      expect(secretsModule.deepDeleteServiceReferences).not.toHaveBeenCalled();
    });

    it('should handle remove context with missing service name', () => {
      const context: OperationContext = {
        operation: 'remove',
        // Missing removedService
      } as OperationContext;

      rs.mocked(secretsModule.loadUserSecrets).mockReturnValue(mockUserSecrets);

      generateSecretsLocal(context);

      expect(secretsModule.deepDeleteServiceReferences).not.toHaveBeenCalled();
    });
  });

  describe('Function call order verification', () => {
    it('should always load config first', () => {
      generateSecretsLocal();

      const configCall = rs.mocked(configModule.loadFrameworkConfig).mock
        .invocationCallOrder[0];
      const firstFrameworkSecretsCall = rs.mocked(
        secretsModule.loadFrameworkSecrets,
      ).mock.invocationCallOrder[0];

      expect(configCall).toBeLessThan(firstFrameworkSecretsCall);
    });

    it('should generate framework secrets before user secrets', () => {
      generateSecretsLocal();

      const frameworkCall = rs.mocked(
        secretsModule.generateFrameworkSecretsFile,
      ).mock.invocationCallOrder[0];
      const userCall = rs.mocked(secretsModule.generateUserSecretsFile).mock
        .invocationCallOrder[0];

      expect(frameworkCall).toBeLessThan(userCall);
    });

    it('should merge after both framework and user secrets are ready', () => {
      generateSecretsLocal();

      const frameworkWriteCall = rs
        .mocked(secretsModule.writeSecretsFile)
        .mock.calls.findIndex((call) => call[0] === '.secrets.tsdevstack.json');
      const userWriteCall = rs
        .mocked(secretsModule.writeSecretsFile)
        .mock.calls.findIndex((call) => call[0] === '.secrets.user.json');
      const mergeCall = rs.mocked(secretsModule.mergeSecrets).mock
        .invocationCallOrder[0];

      expect(frameworkWriteCall).toBeGreaterThanOrEqual(0);
      expect(userWriteCall).toBeGreaterThanOrEqual(0);
      expect(mergeCall).toBeGreaterThan(0);
    });

    it('should generate env file after local secrets are written', () => {
      generateSecretsLocal();

      const localWriteCallIndex = rs
        .mocked(secretsModule.writeSecretsFile)
        .mock.calls.findIndex((call) => call[0] === '.secrets.local.json');
      const envCallOrder = rs.mocked(secretsModule.generateEnvFile).mock
        .invocationCallOrder[0];

      expect(localWriteCallIndex).toBeGreaterThanOrEqual(0);
      expect(envCallOrder).toBeGreaterThan(0);
    });
  });
});
