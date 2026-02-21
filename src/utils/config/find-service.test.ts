import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockLoadFrameworkConfig } = rs.hoisted(() => ({
  mockLoadFrameworkConfig: rs.fn(),
}));

rs.mock('./load-framework-config', () => ({
  loadFrameworkConfig: mockLoadFrameworkConfig,
}));

import { findService } from './find-service';

describe('findService', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should return the service when found', () => {
    const authService = { name: 'auth-service', type: 'nestjs', port: 3000 };
    mockLoadFrameworkConfig.mockReturnValue({
      services: [
        authService,
        { name: 'bff-service', type: 'nestjs', port: 3001 },
      ],
    });

    expect(findService('auth-service')).toEqual(authService);
  });

  it('should return null when service not found', () => {
    mockLoadFrameworkConfig.mockReturnValue({
      services: [{ name: 'auth-service', type: 'nestjs', port: 3000 }],
    });

    expect(findService('missing-service')).toBeNull();
  });

  it('should return null when services array is empty', () => {
    mockLoadFrameworkConfig.mockReturnValue({
      services: [],
    });

    expect(findService('auth-service')).toBeNull();
  });
});
