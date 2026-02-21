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

import { generateSpaEnvFiles } from './generate-spa-env-files';

describe('generateSpaEnvFiles', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockFindProjectRoot.mockReturnValue('/project');
    mockGetServicePath.mockImplementation(
      (name: string, root: string) => `${root}/apps/${name}`,
    );
  });

  it('should generate .env for spa service with direct secrets', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'dashboard', type: 'spa', port: 4001 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      dashboard: { API_URL: 'http://localhost:3000/api' },
    });

    generateSpaEnvFiles(config, '/project');

    expect(mockWriteTextFile).toHaveBeenCalledTimes(1);
    const [path, content] = mockWriteTextFile.mock.calls[0];
    expect(path).toBe('/project/apps/dashboard/.env');
    expect(content).toContain('API_URL=http://localhost:3000/api');
    expect(content).toContain('AUTO-GENERATED');
  });

  it('should resolve secrets references from top-level secrets', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'dashboard', type: 'spa', port: 4001 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {
        ACCESS_TOKEN_TTL: '900',
        API_URL: 'http://localhost:3000',
      },
      dashboard: {
        secrets: ['ACCESS_TOKEN_TTL', 'API_URL'],
        CUSTOM_VAR: 'custom-value',
      },
    });

    generateSpaEnvFiles(config, '/project');

    const [, content] = mockWriteTextFile.mock.calls[0];
    expect(content).toContain('ACCESS_TOKEN_TTL=900');
    expect(content).toContain('API_URL=http://localhost:3000');
    expect(content).toContain('CUSTOM_VAR=custom-value');
  });

  it('should skip NODE_ENV', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'dashboard', type: 'spa', port: 4001 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      dashboard: { NODE_ENV: 'development', API_URL: 'http://localhost' },
    });

    generateSpaEnvFiles(config, '/project');

    const [, content] = mockWriteTextFile.mock.calls[0];
    expect(content).not.toContain('NODE_ENV');
  });

  it('should skip non-string values', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'dashboard', type: 'spa', port: 4001 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      dashboard: { PORT: 4001, API_URL: 'http://localhost' },
    });

    generateSpaEnvFiles(config, '/project');

    const [, content] = mockWriteTextFile.mock.calls[0];
    expect(content).not.toContain('PORT');
  });

  it('should escape special characters in values', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'dashboard', type: 'spa', port: 4001 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      dashboard: { SECRET: 'val$ue"here' },
    });

    generateSpaEnvFiles(config, '/project');

    const [, content] = mockWriteTextFile.mock.calls[0];
    expect(content).toContain('SECRET=val\\$ue\\"here');
  });

  it('should skip non-spa services', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [
        { name: 'auth-service', type: 'nestjs', port: 3000 },
        { name: 'frontend', type: 'nextjs', port: 4000 },
      ],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      'auth-service': { DATABASE_URL: 'postgres://...' },
      frontend: { API_URL: 'http://...' },
    });

    generateSpaEnvFiles(config, '/project');

    expect(mockWriteTextFile).not.toHaveBeenCalled();
  });

  it('should warn when service has no secrets section', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'dashboard', type: 'spa', port: 4001 }],
    };
    mockReadJsonFile.mockReturnValue({ secrets: {} });

    generateSpaEnvFiles(config, '/project');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('dashboard'),
    );
  });

  it('should log info when no SPA services found', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [],
    };
    mockReadJsonFile.mockReturnValue({ secrets: {} });

    generateSpaEnvFiles(config, '/project');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('No SPA services'),
    );
  });

  it('should use findProjectRoot as default rootDir', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [],
    };
    mockReadJsonFile.mockReturnValue({ secrets: {} });

    generateSpaEnvFiles(config);

    expect(mockFindProjectRoot).toHaveBeenCalled();
  });
});
