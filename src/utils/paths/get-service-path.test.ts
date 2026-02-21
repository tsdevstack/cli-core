import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { getServicePath } from './get-service-path';
import { APPS_DIR } from '../../constants';

// Mock dependencies
rs.mock('./find-project-root', () => ({
  findProjectRoot: rs.fn(),
}));

import { findProjectRoot } from './find-project-root';

describe('getServicePath', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should construct path with custom root using APPS_DIR constant', () => {
    const testRoot = '/projects/my-app';
    const serviceName = 'user-service';

    const result = getServicePath(serviceName, testRoot);

    expect(result).toBe(`/projects/my-app/${APPS_DIR}/user-service`);
    expect(findProjectRoot).not.toHaveBeenCalled();
  });

  it('should use findProjectRoot() when root not provided', () => {
    rs.mocked(findProjectRoot).mockReturnValue('/projects/detected-root');
    const serviceName = 'auth-service';

    const result = getServicePath(serviceName);

    expect(result).toBe(`/projects/detected-root/${APPS_DIR}/auth-service`);
    expect(findProjectRoot).toHaveBeenCalledOnce();
  });

  it('should handle different service names correctly', () => {
    const testRoot = '/my/project';
    const testCases = [
      {
        serviceName: 'payment-service',
        expected: `/my/project/${APPS_DIR}/payment-service`,
      },
      {
        serviceName: 'notification',
        expected: `/my/project/${APPS_DIR}/notification`,
      },
      {
        serviceName: 'api-gateway',
        expected: `/my/project/${APPS_DIR}/api-gateway`,
      },
    ];

    testCases.forEach(({ serviceName, expected }) => {
      const result = getServicePath(serviceName, testRoot);
      expect(result).toBe(expected);
    });
  });

  it('should return absolute path', () => {
    const result = getServicePath('test-service', '/root');
    expect(result.startsWith('/')).toBe(true);
  });
});
