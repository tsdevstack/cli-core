/**
 * Tests for generateClient command
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';

// Mock dependencies BEFORE imports
rs.mock('../utils/fs/index', { mock: true });
rs.mock('../utils/validation', { mock: true });
rs.mock('../utils/paths/index', { mock: true });
rs.mock('../utils/template/render-template', { mock: true });
rs.mock('../utils/exec', { mock: true });
rs.mock('../utils/service/resolve-service-name-interactive', { mock: true });
rs.mock('../utils/logger', { mock: true });
// Do NOT mock '../utils/errors' - need real CliError

import { generateClient } from './generate-client';
import * as fsIndex from '../utils/fs/index';
import * as validation from '../utils/validation';
import * as pathsIndex from '../utils/paths/index';
import * as renderTemplateModule from '../utils/template/render-template';
import * as execModule from '../utils/exec';
import * as resolveModule from '../utils/service/resolve-service-name-interactive';
import { CliError } from '../utils/errors';

const mockCliPaths = {
  templatesDir: '/mock/cli/templates',
  swaggerTemplatesDir: '/mock/cli/swagger-ts-templates',
  getTemplate: rs.fn(),
};

describe('generateClient', () => {
  beforeEach(() => {
    rs.resetAllMocks();

    // Default mocks
    rs.mocked(resolveModule.resolveServiceNameInteractive).mockResolvedValue(
      'auth-service',
    );
    rs.mocked(pathsIndex.getServicePath).mockReturnValue(
      '/mock/project/apps/auth-service',
    );
    rs.mocked(pathsIndex.getClientPath).mockReturnValue(
      '/mock/project/packages/auth-service-client',
    );
    rs.mocked(pathsIndex.getCliPaths).mockReturnValue(
      mockCliPaths as unknown as ReturnType<typeof pathsIndex.getCliPaths>,
    );
    rs.mocked(fsIndex.isFile).mockReturnValue(true);
    rs.mocked(fsIndex.readPackageJsonFrom).mockReturnValue({
      name: 'auth-service',
      version: '1.0.0',
      author: 'Test Author',
    });
    rs.mocked(fsIndex.extractAuthor).mockReturnValue('Test Author');
  });

  describe('Service name resolution', () => {
    it('should resolve service name via resolveServiceNameInteractive', async () => {
      await generateClient({ serviceName: 'auth-service' });

      expect(resolveModule.resolveServiceNameInteractive).toHaveBeenCalledWith(
        'auth-service',
      );
    });

    it('should pass undefined when no serviceName provided', async () => {
      await generateClient({});

      expect(resolveModule.resolveServiceNameInteractive).toHaveBeenCalledWith(
        undefined,
      );
    });
  });

  describe('Path resolution', () => {
    it('should get service path from resolved service name', async () => {
      rs.mocked(resolveModule.resolveServiceNameInteractive).mockResolvedValue(
        'offers-service',
      );

      await generateClient({ serviceName: 'offers-service' });

      expect(pathsIndex.getServicePath).toHaveBeenCalledWith('offers-service');
    });

    it('should resolve relative input path against service directory', async () => {
      rs.mocked(pathsIndex.getServicePath).mockReturnValue(
        '/mock/project/apps/auth-service',
      );

      await generateClient({ input: './custom/spec.json' });

      // isFile should be called with the resolved path
      expect(fsIndex.isFile).toHaveBeenCalledWith(
        expect.stringContaining('auth-service'),
      );
    });

    it('should use absolute input path directly when provided', async () => {
      await generateClient({ input: '/absolute/path/to/openapi.json' });

      expect(fsIndex.isFile).toHaveBeenCalledWith(
        '/absolute/path/to/openapi.json',
      );
    });

    it('should use default input path (./docs/openapi.json) when not provided', async () => {
      rs.mocked(pathsIndex.getServicePath).mockReturnValue(
        '/mock/project/apps/auth-service',
      );

      await generateClient({});

      // isFile is called with the resolved default path
      const isFileCall = rs.mocked(fsIndex.isFile).mock.calls[0]?.[0] as string;
      expect(isFileCall).toContain('openapi.json');
    });
  });

  describe('OpenAPI spec validation', () => {
    it('should throw CliError when OpenAPI spec not found', async () => {
      rs.mocked(fsIndex.isFile).mockReturnValue(false);

      await expect(generateClient({})).rejects.toThrow(CliError);
      await expect(generateClient({})).rejects.toThrow(
        'OpenAPI specification not found',
      );
    });

    it('should include input path in error context', async () => {
      rs.mocked(fsIndex.isFile).mockReturnValue(false);

      try {
        await generateClient({});
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).context).toContain('Path:');
      }
    });
  });

  describe('Package.json reading', () => {
    it('should read package.json from service directory', async () => {
      rs.mocked(pathsIndex.getServicePath).mockReturnValue(
        '/mock/project/apps/auth-service',
      );

      await generateClient({});

      expect(fsIndex.readPackageJsonFrom).toHaveBeenCalledWith(
        '/mock/project/apps/auth-service',
      );
    });

    it('should extract author from package.json', async () => {
      const mockPackageJson = {
        name: 'auth-service',
        version: '1.0.0',
        author: 'Jane Doe',
      };
      rs.mocked(fsIndex.readPackageJsonFrom).mockReturnValue(mockPackageJson);

      await generateClient({});

      expect(fsIndex.extractAuthor).toHaveBeenCalledWith(mockPackageJson);
    });
  });

  describe('Service validation', () => {
    it('should validate service complete', async () => {
      rs.mocked(resolveModule.resolveServiceNameInteractive).mockResolvedValue(
        'auth-service',
      );

      await generateClient({});

      expect(validation.validateServiceComplete).toHaveBeenCalledWith(
        'auth-service',
      );
    });
  });

  describe('Client package name derivation', () => {
    it('should derive client package name as serviceName-client', async () => {
      rs.mocked(resolveModule.resolveServiceNameInteractive).mockResolvedValue(
        'offers-service',
      );
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/offers-service-client',
      );

      await generateClient({});

      // Verify template data includes derived package name
      expect(renderTemplateModule.renderTemplate).toHaveBeenCalledWith(
        expect.stringContaining('client-package.json.hbs'),
        expect.any(String),
        expect.objectContaining({
          packageName: '@shared/offers-service-client',
          serviceName: 'offers-service',
        }),
      );
    });
  });

  describe('Directory setup', () => {
    it('should clean dist folder before generation', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      expect(fsIndex.deleteFolderRecursive).toHaveBeenCalledWith(
        '/mock/project/packages/auth-service-client/dist',
      );
    });

    it('should ensure package directory exists', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      expect(fsIndex.ensureDirectory).toHaveBeenCalledWith(
        '/mock/project/packages/auth-service-client',
      );
    });

    it('should ensure output (src) directory exists', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      expect(fsIndex.ensureDirectory).toHaveBeenCalledWith(
        '/mock/project/packages/auth-service-client/src',
      );
    });

    it('should ensure dto output directory exists', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      expect(fsIndex.ensureDirectory).toHaveBeenCalledWith(
        '/mock/project/packages/auth-service-client/dto',
      );
    });
  });

  describe('Template rendering', () => {
    it('should render package.json template with correct data', async () => {
      rs.mocked(resolveModule.resolveServiceNameInteractive).mockResolvedValue(
        'auth-service',
      );
      rs.mocked(fsIndex.extractAuthor).mockReturnValue('John Doe');
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      expect(renderTemplateModule.renderTemplate).toHaveBeenCalledWith(
        '/mock/cli/templates/client-package.json.hbs',
        '/mock/project/packages/auth-service-client/package.json',
        {
          packageName: '@shared/auth-service-client',
          serviceName: 'auth-service',
          author: 'John Doe',
        },
      );
    });

    it('should render tsconfig.json template', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      expect(renderTemplateModule.renderTemplate).toHaveBeenCalledWith(
        '/mock/cli/templates/client-tsconfig.json.hbs',
        '/mock/project/packages/auth-service-client/tsconfig.json',
      );
    });

    it('should render index.ts template', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      expect(renderTemplateModule.renderTemplate).toHaveBeenCalledWith(
        '/mock/cli/templates/index.ts.hbs',
        '/mock/project/packages/auth-service-client/src/index.ts',
      );
    });
  });

  describe('Client code generation', () => {
    it('should execute swagger-typescript-api for client generation', async () => {
      await generateClient({});

      expect(execModule.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining('swagger-typescript-api generate'),
        expect.objectContaining({ logCommand: true }),
      );
    });

    it('should include correct flags in client generation command', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      const firstCall = rs.mocked(execModule.executeCommand).mock
        .calls[0]?.[0] as string;
      expect(firstCall).toContain('--axios');
      expect(firstCall).toContain('--route-types');
      expect(firstCall).toContain('--extract-request-params');
      expect(firstCall).toContain('--class-transformers');
      expect(firstCall).toContain('--module-name-index 1');
      expect(firstCall).toContain(
        `-o /mock/project/packages/auth-service-client/src`,
      );
    });

    it('should use custom moduleNameIndex when provided', async () => {
      await generateClient({ moduleNameIndex: 2 });

      const firstCall = rs.mocked(execModule.executeCommand).mock
        .calls[0]?.[0] as string;
      expect(firstCall).toContain('--module-name-index 2');
    });
  });

  describe('DTO generation', () => {
    it('should execute swagger-typescript-api for DTO generation', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      const secondCall = rs.mocked(execModule.executeCommand).mock
        .calls[1]?.[0] as string;
      expect(secondCall).toContain('swagger-typescript-api generate');
      expect(secondCall).toContain('--modular');
      expect(secondCall).toContain(
        `--templates /mock/cli/swagger-ts-templates`,
      );
      expect(secondCall).toContain(
        `-o /mock/project/packages/auth-service-client/dto`,
      );
      expect(secondCall).toContain('--name index.ts');
    });
  });

  describe('DTO cleanup', () => {
    it('should clean up dto folder keeping only data-contracts.ts', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      expect(fsIndex.cleanupFolder).toHaveBeenCalledWith(
        '/mock/project/packages/auth-service-client/dto',
        ['data-contracts.ts'],
      );
    });
  });

  describe('Client package build', () => {
    it('should build client package with executeNpmCommand', async () => {
      rs.mocked(pathsIndex.getClientPath).mockReturnValue(
        '/mock/project/packages/auth-service-client',
      );

      await generateClient({});

      expect(execModule.executeNpmCommand).toHaveBeenCalledWith(
        'build',
        '/mock/project/packages/auth-service-client',
      );
    });

    it('should throw CliError when build fails with Error', async () => {
      rs.mocked(execModule.executeNpmCommand).mockImplementation(() => {
        throw new Error('tsc compilation failed');
      });

      await expect(generateClient({})).rejects.toThrow(CliError);
      await expect(generateClient({})).rejects.toThrow(
        'Client package build failed: tsc compilation failed',
      );
    });

    it('should throw CliError when build fails with non-Error', async () => {
      rs.mocked(execModule.executeNpmCommand).mockImplementation(() => {
        throw 'string error';
      });

      await expect(generateClient({})).rejects.toThrow(CliError);
      await expect(generateClient({})).rejects.toThrow(
        'Client package build failed: string error',
      );
    });

    it('should include package name in build error context', async () => {
      rs.mocked(resolveModule.resolveServiceNameInteractive).mockResolvedValue(
        'offers-service',
      );
      rs.mocked(execModule.executeNpmCommand).mockImplementation(() => {
        throw new Error('build error');
      });

      try {
        await generateClient({});
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CliError);
        expect((error as CliError).context).toBe(
          'Package: @shared/offers-service-client',
        );
      }
    });
  });

  describe('Execution order', () => {
    it('should call deleteFolderRecursive before ensureDirectory', async () => {
      const callOrder: string[] = [];
      rs.mocked(fsIndex.deleteFolderRecursive).mockImplementation(() => {
        callOrder.push('deleteFolderRecursive');
      });
      rs.mocked(fsIndex.ensureDirectory).mockImplementation(() => {
        callOrder.push('ensureDirectory');
      });

      await generateClient({});

      const deleteIndex = callOrder.indexOf('deleteFolderRecursive');
      const firstEnsureIndex = callOrder.indexOf('ensureDirectory');
      expect(deleteIndex).toBeLessThan(firstEnsureIndex);
    });

    it('should render templates before executing swagger commands', async () => {
      const callOrder: string[] = [];
      rs.mocked(renderTemplateModule.renderTemplate).mockImplementation(() => {
        callOrder.push('renderTemplate');
      });
      rs.mocked(execModule.executeCommand).mockImplementation(() => {
        callOrder.push('executeCommand');
      });

      await generateClient({});

      const lastRender = callOrder.lastIndexOf('renderTemplate');
      const firstExecute = callOrder.indexOf('executeCommand');
      expect(lastRender).toBeLessThan(firstExecute);
    });
  });
});
