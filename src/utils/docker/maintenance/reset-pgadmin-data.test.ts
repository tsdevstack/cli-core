import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockDeleteFolderRecursive } = rs.hoisted(() => ({
  mockDeleteFolderRecursive: rs.fn(),
}));

rs.mock('../../fs', () => ({
  deleteFolderRecursive: mockDeleteFolderRecursive,
}));

import { resetPgAdminData } from './reset-pgadmin-data';

describe('resetPgAdminData', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should delete the pgadmin data directory', () => {
    resetPgAdminData('/project');

    expect(mockDeleteFolderRecursive).toHaveBeenCalledWith(
      '/project/data/pgadmin',
    );
  });

  it('should return true when deletion succeeds', () => {
    const result = resetPgAdminData('/project');

    expect(result).toBe(true);
  });

  it('should return false when deletion fails', () => {
    mockDeleteFolderRecursive.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const result = resetPgAdminData('/project');

    expect(result).toBe(false);
  });

  it('should default rootDir to process.cwd()', () => {
    resetPgAdminData();

    const calledPath = mockDeleteFolderRecursive.mock.calls[0][0] as string;
    expect(calledPath).toContain('data/pgadmin');
  });
});
