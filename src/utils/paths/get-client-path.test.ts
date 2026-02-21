import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { getClientPath } from './get-client-path';
import { PACKAGES_DIR } from '../../constants';

// Mock dependencies
rs.mock('./find-project-root', () => ({
  findProjectRoot: rs.fn(),
}));

import { findProjectRoot } from './find-project-root';

describe('getClientPath', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should construct path with custom root using PACKAGES_DIR constant', () => {
    const testRoot = '/projects/my-app';
    const serviceName = 'user-service';

    const result = getClientPath(serviceName, testRoot);

    expect(result).toBe(`/projects/my-app/${PACKAGES_DIR}/user-service-client`);
    expect(findProjectRoot).not.toHaveBeenCalled();
  });

  it('should append "-client" suffix to service name', () => {
    const testRoot = '/projects/my-app';
    const serviceName = 'auth-service';

    const result = getClientPath(serviceName, testRoot);

    expect(result).toContain('auth-service-client');
    expect(result).toBe(`/projects/my-app/${PACKAGES_DIR}/auth-service-client`);
  });

  it('should use findProjectRoot() when root not provided', () => {
    rs.mocked(findProjectRoot).mockReturnValue('/projects/detected-root');
    const serviceName = 'payment-service';

    const result = getClientPath(serviceName);

    expect(result).toBe(
      `/projects/detected-root/${PACKAGES_DIR}/payment-service-client`,
    );
    expect(findProjectRoot).toHaveBeenCalledOnce();
  });

  it('should handle different service names correctly', () => {
    const testRoot = '/my/project';
    const testCases = [
      {
        serviceName: 'auth',
        expected: `/my/project/${PACKAGES_DIR}/auth-client`,
      },
      {
        serviceName: 'notification-service',
        expected: `/my/project/${PACKAGES_DIR}/notification-service-client`,
      },
      {
        serviceName: 'api',
        expected: `/my/project/${PACKAGES_DIR}/api-client`,
      },
    ];

    testCases.forEach(({ serviceName, expected }) => {
      const result = getClientPath(serviceName, testRoot);
      expect(result).toBe(expected);
    });
  });

  it('should return absolute path', () => {
    const result = getClientPath('test-service', '/root');
    expect(result.startsWith('/')).toBe(true);
  });
});
