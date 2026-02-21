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

import { generateBackendEnvFiles } from './generate-backend-env-files';

describe('generateBackendEnvFiles', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockFindProjectRoot.mockReturnValue('/project');
    mockGetServicePath.mockImplementation(
      (name: string, root: string) => `${root}/apps/${name}`,
    );
  });

  it('should generate .env for backend service with DATABASE_URL', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      'auth-service': { DATABASE_URL: 'postgresql://localhost:5432/auth' },
    });

    generateBackendEnvFiles(config, '/project');

    expect(mockWriteTextFile).toHaveBeenCalledTimes(1);
    const [path, content] = mockWriteTextFile.mock.calls[0];
    expect(path).toBe('/project/apps/auth-service/.env');
    expect(content).toContain(
      'DATABASE_URL="postgresql://localhost:5432/auth"',
    );
    expect(content).toContain('AUTO-GENERATED');
    expect(mockLogger.success).toHaveBeenCalled();
  });

  it('should skip services without DATABASE_URL', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'bff-service', type: 'nestjs', port: 3001 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      'bff-service': { API_KEY: 'some-key' },
    });

    generateBackendEnvFiles(config, '/project');

    expect(mockWriteTextFile).not.toHaveBeenCalled();
  });

  it('should skip non-backend services', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [
        { name: 'frontend', type: 'nextjs', port: 4000 },
        { name: 'spa-app', type: 'spa', port: 4001 },
      ],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      frontend: { DATABASE_URL: 'postgres://...' },
      'spa-app': { API_URL: 'http://...' },
    });

    generateBackendEnvFiles(config, '/project');

    expect(mockWriteTextFile).not.toHaveBeenCalled();
  });

  it('should warn when service has no secrets section', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
    });

    generateBackendEnvFiles(config, '/project');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('auth-service'),
    );
  });

  it('should log info when no backend services found', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [],
    };
    mockReadJsonFile.mockReturnValue({ secrets: {} });

    generateBackendEnvFiles(config, '/project');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('No backend services'),
    );
  });

  it('should process multiple backend services', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [
        { name: 'auth-service', type: 'nestjs', port: 3000 },
        { name: 'offers-service', type: 'nestjs', port: 3002 },
      ],
    };
    mockReadJsonFile.mockReturnValue({
      secrets: {},
      'auth-service': { DATABASE_URL: 'postgresql://localhost:5432/auth' },
      'offers-service': { DATABASE_URL: 'postgresql://localhost:5432/offers' },
    });

    generateBackendEnvFiles(config, '/project');

    expect(mockWriteTextFile).toHaveBeenCalledTimes(2);
  });

  it('should use findProjectRoot as default rootDir', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [],
    };
    mockReadJsonFile.mockReturnValue({ secrets: {} });

    generateBackendEnvFiles(config);

    expect(mockFindProjectRoot).toHaveBeenCalled();
  });
});
