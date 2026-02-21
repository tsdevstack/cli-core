import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockExecuteCommand, mockGetServicePath } = rs.hoisted(() => ({
  mockExecuteCommand: rs.fn(),
  mockGetServicePath: rs.fn(),
}));

rs.mock('../exec', () => ({
  executeCommand: mockExecuteCommand,
}));
rs.mock('../paths', () => ({
  getServicePath: mockGetServicePath,
}));

import { deployPrismaMigration } from './deploy-prisma-migration';

describe('deployPrismaMigration', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockGetServicePath.mockReturnValue('/project/apps/auth-service');
  });

  it('should execute prisma migrate deploy with DATABASE_URL', () => {
    deployPrismaMigration('auth-service', 'postgresql://localhost:5432/auth');

    expect(mockExecuteCommand).toHaveBeenCalledWith(
      'DATABASE_URL="postgresql://localhost:5432/auth" npx prisma migrate deploy',
      { cwd: '/project/apps/auth-service' },
    );
  });

  it('should resolve service path for the given service name', () => {
    deployPrismaMigration(
      'offers-service',
      'postgresql://localhost:5432/offers',
    );

    expect(mockGetServicePath).toHaveBeenCalledWith('offers-service');
  });

  it('should use the correct cwd from getServicePath', () => {
    mockGetServicePath.mockReturnValue('/custom/path/apps/my-service');

    deployPrismaMigration('my-service', 'postgresql://localhost:5432/db');

    expect(mockExecuteCommand).toHaveBeenCalledWith(expect.any(String), {
      cwd: '/custom/path/apps/my-service',
    });
  });
});
