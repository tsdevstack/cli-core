import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockIsFile, mockGetPrismaSchemaPath } = rs.hoisted(() => ({
  mockIsFile: rs.fn(),
  mockGetPrismaSchemaPath: rs.fn(),
}));

rs.mock('../fs', () => ({
  isFile: mockIsFile,
}));

rs.mock('../paths', () => ({
  getPrismaSchemaPath: mockGetPrismaSchemaPath,
}));

import { hasPrismaSchema } from './has-prisma-schema';

describe('hasPrismaSchema', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should return true when schema file exists', () => {
    mockGetPrismaSchemaPath.mockReturnValue(
      '/project/apps/auth-service/prisma/schema.prisma',
    );
    mockIsFile.mockReturnValue(true);

    expect(hasPrismaSchema('auth-service')).toBe(true);
  });

  it('should return false when schema file does not exist', () => {
    mockGetPrismaSchemaPath.mockReturnValue(
      '/project/apps/bff-service/prisma/schema.prisma',
    );
    mockIsFile.mockReturnValue(false);

    expect(hasPrismaSchema('bff-service')).toBe(false);
  });

  it('should pass service name to getPrismaSchemaPath', () => {
    mockGetPrismaSchemaPath.mockReturnValue('/some/path');
    mockIsFile.mockReturnValue(false);

    hasPrismaSchema('offers-service');

    expect(mockGetPrismaSchemaPath).toHaveBeenCalledWith('offers-service');
  });

  it('should pass schema path to isFile', () => {
    mockGetPrismaSchemaPath.mockReturnValue(
      '/project/apps/auth-service/prisma/schema.prisma',
    );
    mockIsFile.mockReturnValue(true);

    hasPrismaSchema('auth-service');

    expect(mockIsFile).toHaveBeenCalledWith(
      '/project/apps/auth-service/prisma/schema.prisma',
    );
  });
});
