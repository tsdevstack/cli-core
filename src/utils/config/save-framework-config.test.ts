import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockWriteJsonFile, mockGetConfigPath } = rs.hoisted(() => ({
  mockWriteJsonFile: rs.fn(),
  mockGetConfigPath: rs.fn(),
}));

rs.mock('../fs', () => ({
  writeJsonFile: mockWriteJsonFile,
}));
rs.mock('../paths', () => ({
  getConfigPath: mockGetConfigPath,
}));

import { saveFrameworkConfig } from './save-framework-config';
import type { FrameworkConfig } from './types';

describe('saveFrameworkConfig', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockGetConfigPath.mockReturnValue('/project/.tsdevstack/config.json');
  });

  it('should save config to the correct path', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: 'gcp' },
      services: [],
    };

    saveFrameworkConfig(config);

    expect(mockGetConfigPath).toHaveBeenCalled();
    expect(mockWriteJsonFile).toHaveBeenCalledWith(
      '/project/.tsdevstack/config.json',
      config,
    );
  });

  it('should pass the full config object to writeJsonFile', () => {
    const config: FrameworkConfig = {
      project: { name: 'my-app', version: '2.0.0', description: 'My app' },
      cloud: { provider: 'aws' },
      services: [
        { name: 'auth-service', type: 'nestjs', port: 3000 },
        { name: 'frontend', type: 'nextjs', port: 4000 },
      ],
    };

    saveFrameworkConfig(config);

    const [, savedConfig] = mockWriteJsonFile.mock.calls[0];
    expect(savedConfig).toEqual(config);
    expect(savedConfig.services).toHaveLength(2);
  });
});
