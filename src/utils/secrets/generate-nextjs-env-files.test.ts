import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import type { FrameworkConfig } from '../config';

const {
  mockWriteTextFile,
  mockReadJsonFile,
  mockFindProjectRoot,
  mockGetServicePath,
  mockLogger,
} = rs.hoisted(() => ({
  mockWriteTextFile: rs.fn(),
  mockReadJsonFile: rs.fn(),
  mockFindProjectRoot: rs.fn(),
  mockGetServicePath: rs.fn(),
  mockLogger: {
    success: rs.fn(),
    warn: rs.fn(),
    info: rs.fn(),
  },
}));

rs.mock('../logger', () => ({
  logger: mockLogger,
}));
rs.mock('../fs', () => ({
  writeTextFile: mockWriteTextFile,
  readJsonFile: mockReadJsonFile,
}));
rs.mock('../paths', () => ({
  findProjectRoot: mockFindProjectRoot,
}));
rs.mock('../paths/get-service-path', () => ({
  getServicePath: mockGetServicePath,
}));

import { generateNextjsEnvFiles } from './generate-nextjs-env-files';

describe('generateNextjsEnvFiles', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockFindProjectRoot.mockReturnValue('/project');
    mockGetServicePath.mockImplementation(
      (name: string, root: string) => `${root}/apps/${name}`,
    );
  });

  it('should generate .env for nextjs service with direct secrets', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'frontend', type: 'nextjs', port: 4000 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: { API_URL: 'http://localhost:3000' },
      frontend: { NEXT_PUBLIC_API: 'http://localhost:3000' },
    });

    generateNextjsEnvFiles(config, '/project');

    expect(mockWriteTextFile).toHaveBeenCalledTimes(1);
    const [path, content] = mockWriteTextFile.mock.calls[0];
    expect(path).toBe('/project/apps/frontend/.env');
    expect(content).toContain('NEXT_PUBLIC_API=http://localhost:3000');
    expect(content).toContain('AUTO-GENERATED');
  });

  it('should resolve secrets references from top-level secrets', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'frontend', type: 'nextjs', port: 4000 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {
        ACCESS_TOKEN_TTL: '900',
        REFRESH_TOKEN_TTL: '604800',
      },
      frontend: {
        secrets: ['ACCESS_TOKEN_TTL', 'REFRESH_TOKEN_TTL'],
        NEXT_PUBLIC_APP_NAME: 'My App',
      },
    });

    generateNextjsEnvFiles(config, '/project');

    const [, content] = mockWriteTextFile.mock.calls[0];
    expect(content).toContain('ACCESS_TOKEN_TTL=900');
    expect(content).toContain('REFRESH_TOKEN_TTL=604800');
    expect(content).toContain('NEXT_PUBLIC_APP_NAME=My App');
  });

  it('should skip NODE_ENV', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'frontend', type: 'nextjs', port: 4000 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      frontend: { NODE_ENV: 'development', API_URL: 'http://localhost' },
    });

    generateNextjsEnvFiles(config, '/project');

    const [, content] = mockWriteTextFile.mock.calls[0];
    expect(content).not.toContain('NODE_ENV');
    expect(content).toContain('API_URL=http://localhost');
  });

  it('should skip non-string values', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'frontend', type: 'nextjs', port: 4000 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      frontend: { PORT: 4000, API_URL: 'http://localhost' },
    });

    generateNextjsEnvFiles(config, '/project');

    const [, content] = mockWriteTextFile.mock.calls[0];
    expect(content).not.toContain('PORT');
    expect(content).toContain('API_URL=http://localhost');
  });

  it('should escape special characters in values', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'frontend', type: 'nextjs', port: 4000 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      frontend: { SECRET: 'has$dollar"quote' },
    });

    generateNextjsEnvFiles(config, '/project');

    const [, content] = mockWriteTextFile.mock.calls[0];
    expect(content).toContain('SECRET=has\\$dollar\\"quote');
  });

  it('should skip non-nextjs services', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [
        { name: 'auth-service', type: 'nestjs', port: 3000 },
        { name: 'spa-app', type: 'spa', port: 4001 },
      ],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      'auth-service': { DATABASE_URL: 'postgres://...' },
      'spa-app': { API_URL: 'http://...' },
    });

    generateNextjsEnvFiles(config, '/project');

    expect(mockWriteTextFile).not.toHaveBeenCalled();
  });

  it('should warn when service has no secrets section', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'frontend', type: 'nextjs', port: 4000 }],
    };
    mockReadJsonFile.mockReturnValue({ secrets: {} });

    generateNextjsEnvFiles(config, '/project');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('frontend'),
    );
  });

  it('should log info when no nextjs services found', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [],
    };
    mockReadJsonFile.mockReturnValue({ secrets: {} });

    generateNextjsEnvFiles(config, '/project');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('No Next.js services'),
    );
  });

  it('should skip secrets references that dont exist in top-level', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'frontend', type: 'nextjs', port: 4000 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: { EXISTING: 'value' },
      frontend: {
        secrets: ['EXISTING', 'NONEXISTENT'],
        DIRECT: 'direct-value',
      },
    });

    generateNextjsEnvFiles(config, '/project');

    const [, content] = mockWriteTextFile.mock.calls[0];
    expect(content).toContain('EXISTING=value');
    expect(content).not.toContain('NONEXISTENT');
    expect(content).toContain('DIRECT=direct-value');
  });
});
