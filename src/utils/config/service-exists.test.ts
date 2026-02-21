import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockFindService } = rs.hoisted(() => ({
  mockFindService: rs.fn(),
}));

rs.mock('./find-service', () => ({
  findService: mockFindService,
}));

import { serviceExists } from './service-exists';

describe('serviceExists', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should return true when findService returns a service', () => {
    mockFindService.mockReturnValue({ name: 'auth-service', type: 'nestjs' });
    expect(serviceExists('auth-service')).toBe(true);
  });

  it('should return false when findService returns null', () => {
    mockFindService.mockReturnValue(null);
    expect(serviceExists('missing-service')).toBe(false);
  });
});
