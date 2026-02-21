import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { getPrismaSchemaPath } from './get-prisma-schema-path';

// Mock dependencies
rs.mock('./find-project-root', () => ({
  findProjectRoot: rs.fn(),
}));

rs.mock('./get-service-path', () => ({
  getServicePath: rs.fn(),
}));

import { findProjectRoot } from './find-project-root';
import { getServicePath } from './get-service-path';

describe('getPrismaSchemaPath', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should construct path by calling getServicePath with custom root', () => {
    const testRoot = '/projects/my-app';
    const serviceName = 'user-service';
    rs.mocked(getServicePath).mockReturnValue(
      '/projects/my-app/apps/user-service',
    );

    const result = getPrismaSchemaPath(serviceName, testRoot);

    expect(result).toBe(
      '/projects/my-app/apps/user-service/prisma/schema.prisma',
    );
    expect(getServicePath).toHaveBeenCalledWith(serviceName, testRoot);
    expect(findProjectRoot).not.toHaveBeenCalled();
  });

  it('should pass through root parameter to getServicePath', () => {
    const testRoot = '/custom/root';
    const serviceName = 'auth-service';
    rs.mocked(getServicePath).mockReturnValue('/custom/root/apps/auth-service');

    getPrismaSchemaPath(serviceName, testRoot);

    expect(getServicePath).toHaveBeenCalledWith(serviceName, testRoot);
  });

  it('should use findProjectRoot() when root not provided', () => {
    rs.mocked(findProjectRoot).mockReturnValue('/projects/detected-root');
    rs.mocked(getServicePath).mockReturnValue(
      '/projects/detected-root/apps/payment-service',
    );
    const serviceName = 'payment-service';

    const result = getPrismaSchemaPath(serviceName);

    expect(result).toBe(
      '/projects/detected-root/apps/payment-service/prisma/schema.prisma',
    );
    // getServicePath will call findProjectRoot internally
  });

  it('should always append prisma/schema.prisma to service path', () => {
    const serviceName = 'test-service';
    rs.mocked(getServicePath).mockReturnValue('/root/apps/test-service');

    const result = getPrismaSchemaPath(serviceName, '/root');

    expect(result).toContain('prisma/schema.prisma');
    expect(result.endsWith('prisma/schema.prisma')).toBe(true);
  });

  it('should handle different service names', () => {
    const testCases = [
      { serviceName: 'auth-service', mockPath: '/apps/auth-service' },
      { serviceName: 'notification', mockPath: '/apps/notification' },
      { serviceName: 'api-gateway', mockPath: '/apps/api-gateway' },
    ];

    testCases.forEach(({ serviceName, mockPath }) => {
      rs.mocked(getServicePath).mockReturnValue(mockPath);
      const result = getPrismaSchemaPath(serviceName, '/root');
      expect(result).toBe(`${mockPath}/prisma/schema.prisma`);
    });
  });
});
