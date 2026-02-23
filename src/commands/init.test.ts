import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const {
  mockSpawnSync,
  mockExistsSync,
  mockPromptInitOptions,
  mockCheckPrerequisites,
  mockGetCliVersion,
  mockBuildConfig,
  mockReplaceMonorepoPlaceholders,
  mockScaffoldAuthService,
  mockScaffoldFrontend,
  mockPrintNextSteps,
  mockCloneTemplateRepo,
  mockRemoveTemplateMetadata,
  mockWriteJsonFile,
  mockLogger,
} = rs.hoisted(() => ({
  mockSpawnSync: rs.fn(),
  mockExistsSync: rs.fn(),
  mockPromptInitOptions: rs.fn(),
  mockCheckPrerequisites: rs.fn(),
  mockGetCliVersion: rs.fn(),
  mockBuildConfig: rs.fn(),
  mockReplaceMonorepoPlaceholders: rs.fn(),
  mockScaffoldAuthService: rs.fn(),
  mockScaffoldFrontend: rs.fn(),
  mockPrintNextSteps: rs.fn(),
  mockCloneTemplateRepo: rs.fn(),
  mockRemoveTemplateMetadata: rs.fn(),
  mockWriteJsonFile: rs.fn(),
  mockLogger: {
    newline: rs.fn(),
    info: rs.fn(),
    generating: rs.fn(),
    success: rs.fn(),
    warn: rs.fn(),
    complete: rs.fn(),
  },
}));

rs.mock('child_process', () => ({
  spawnSync: mockSpawnSync,
}));
rs.mock('fs', () => ({
  existsSync: mockExistsSync,
}));
rs.mock('../utils/init', () => ({
  promptInitOptions: mockPromptInitOptions,
  checkPrerequisites: mockCheckPrerequisites,
  getCliVersion: mockGetCliVersion,
  buildConfig: mockBuildConfig,
  replaceMonorepoPlaceholders: mockReplaceMonorepoPlaceholders,
  scaffoldAuthService: mockScaffoldAuthService,
  scaffoldFrontend: mockScaffoldFrontend,
  printNextSteps: mockPrintNextSteps,
}));
rs.mock('../utils/template', () => ({
  cloneTemplateRepo: mockCloneTemplateRepo,
  removeTemplateMetadata: mockRemoveTemplateMetadata,
}));
rs.mock('../utils/fs', () => ({
  writeJsonFile: mockWriteJsonFile,
}));
rs.mock('../utils/logger', () => ({
  logger: mockLogger,
}));
rs.mock('../utils/errors', () => ({
  CliError: class CliError extends Error {
    constructor(
      message: string,
      public context?: string,
      public hint?: string,
    ) {
      super(message);
    }
  },
}));

import { init } from './init';
import { MONOREPO_TEMPLATE_REPO } from '../constants';

describe('init', () => {
  const defaultOptions = {
    projectName: 'my-app',
    template: 'empty' as const,
    frontendName: null,
    cloudProvider: null,
  };

  const defaultConfig = {
    project: { name: 'my-app', version: '0.1.0' },
    framework: { template: null },
    cloud: { provider: null },
    services: [],
  };

  beforeEach(() => {
    rs.clearAllMocks();

    mockExistsSync.mockReturnValue(false);
    mockPromptInitOptions.mockResolvedValue(defaultOptions);
    mockCheckPrerequisites.mockReturnValue({ errors: [], warnings: [] });
    mockGetCliVersion.mockReturnValue('1.0.0');
    mockBuildConfig.mockReturnValue({ ...defaultConfig, services: [] });
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
      pid: 1234,
      output: [],
      signal: null,
    });
  });

  describe('Standard use cases', () => {
    it('should prompt for init options', async () => {
      await init({});

      expect(mockPromptInitOptions).toHaveBeenCalledWith({});
    });

    it('should pass CLI args to promptInitOptions', async () => {
      const args = {
        name: 'my-app',
        template: 'auth',
        cloud: 'gcp',
      };

      await init(args);

      expect(mockPromptInitOptions).toHaveBeenCalledWith(args);
    });

    it('should check prerequisites', async () => {
      await init({});

      expect(mockCheckPrerequisites).toHaveBeenCalled();
    });

    it('should clone monorepo template', async () => {
      await init({});

      expect(mockCloneTemplateRepo).toHaveBeenCalledWith(
        MONOREPO_TEMPLATE_REPO,
        expect.stringContaining('my-app'),
      );
    });

    it('should replace monorepo placeholders', async () => {
      await init({});

      expect(mockReplaceMonorepoPlaceholders).toHaveBeenCalledWith(
        expect.stringContaining('my-app'),
        'my-app',
        '1.0.0',
      );
    });

    it('should remove template metadata', async () => {
      await init({});

      expect(mockRemoveTemplateMetadata).toHaveBeenCalledWith(
        expect.stringContaining('my-app'),
      );
    });

    it('should build config from options', async () => {
      await init({});

      expect(mockBuildConfig).toHaveBeenCalledWith(defaultOptions);
    });

    it('should write config.json', async () => {
      await init({});

      expect(mockWriteJsonFile).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        expect.objectContaining({ services: [] }),
      );
    });

    it('should run npm install', async () => {
      await init({});

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({ cwd: expect.stringContaining('my-app') }),
      );
    });
  });

  describe('Template-specific scaffolding', () => {
    it('should scaffold auth-service for auth template', async () => {
      mockPromptInitOptions.mockResolvedValue({
        ...defaultOptions,
        template: 'auth',
      });

      await init({});

      expect(mockScaffoldAuthService).toHaveBeenCalledWith(
        expect.stringContaining('my-app'),
        expect.any(Object),
      );
    });

    it('should scaffold auth-service and frontend for fullstack-auth template', async () => {
      const config = { ...defaultConfig, services: [{ name: 'auth-service' }] };
      mockBuildConfig.mockReturnValue(config);
      mockPromptInitOptions.mockResolvedValue({
        ...defaultOptions,
        template: 'fullstack-auth',
        frontendName: 'frontend',
      });

      await init({});

      expect(mockScaffoldAuthService).toHaveBeenCalled();
      expect(mockScaffoldFrontend).toHaveBeenCalledWith(
        expect.stringContaining('my-app'),
        'frontend',
        expect.any(Object),
      );
    });

    it('should not scaffold services for empty template', async () => {
      await init({});

      expect(mockScaffoldAuthService).not.toHaveBeenCalled();
      expect(mockScaffoldFrontend).not.toHaveBeenCalled();
    });

    it('should run sync when services exist', async () => {
      const config = {
        ...defaultConfig,
        services: [{ name: 'auth-service', type: 'nestjs', port: 3001 }],
      };
      mockBuildConfig.mockReturnValue(config);
      mockPromptInitOptions.mockResolvedValue({
        ...defaultOptions,
        template: 'auth',
      });

      await init({});

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'npx',
        ['tsdevstack', 'sync'],
        expect.objectContaining({ cwd: expect.stringContaining('my-app') }),
      );
    });

    it('should not run sync for empty template', async () => {
      await init({});

      const syncCalls = mockSpawnSync.mock.calls.filter(
        (call: unknown[]) =>
          Array.isArray(call[1]) && (call[1] as string[]).includes('sync'),
      );
      expect(syncCalls).toHaveLength(0);
    });
  });

  describe('Error cases', () => {
    it('should throw when directory already exists', async () => {
      mockExistsSync.mockReturnValue(true);

      await expect(init({})).rejects.toThrow('already exists');
    });

    it('should throw when prerequisites have errors', async () => {
      mockCheckPrerequisites.mockReturnValue({
        errors: ['git is required but not installed'],
        warnings: [],
      });

      await expect(init({})).rejects.toThrow('git is required');
    });

    it('should log warnings from prerequisites', async () => {
      mockCheckPrerequisites.mockReturnValue({
        errors: [],
        warnings: ['Docker not found'],
      });

      await init({});

      expect(mockLogger.warn).toHaveBeenCalledWith('Docker not found');
    });

    it('should warn when npm install fails', async () => {
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from('error'),
        pid: 1234,
        output: [],
        signal: null,
      });

      await init({});

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('npm install had issues'),
      );
    });
  });

  describe('Completion', () => {
    it('should print next steps', async () => {
      await init({});

      expect(mockPrintNextSteps).toHaveBeenCalledWith(defaultOptions);
    });
  });
});
