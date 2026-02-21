import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import * as path from 'path';

const { mockFindProjectRoot } = rs.hoisted(() => ({
  mockFindProjectRoot: rs.fn(),
}));

rs.mock('./find-project-root', () => ({
  findProjectRoot: mockFindProjectRoot,
}));

import { getClientSrcPath } from './get-client-src-path';

describe('getClientSrcPath', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockFindProjectRoot.mockReturnValue('/default/root');
  });

  it('should build path with default project root', () => {
    const result = getClientSrcPath('auth-client');
    expect(result).toBe(
      path.join('/default/root', 'packages', 'auth-client', 'src'),
    );
  });

  it('should build path with explicit root', () => {
    const result = getClientSrcPath('bff-client', '/custom/root');
    expect(result).toBe(
      path.join('/custom/root', 'packages', 'bff-client', 'src'),
    );
  });

  it('should not call findProjectRoot when root is provided', () => {
    getClientSrcPath('auth-client', '/explicit/root');
    expect(mockFindProjectRoot).not.toHaveBeenCalled();
  });
});
