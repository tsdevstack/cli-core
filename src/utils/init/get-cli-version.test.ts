import { describe, it, expect, rs } from '@rstest/core';

const { mockReadFileSync } = rs.hoisted(() => ({
  mockReadFileSync: rs.fn(),
}));

rs.mock('fs', () => ({
  readFileSync: mockReadFileSync,
}));

import { getCliVersion } from './get-cli-version';

describe('getCliVersion', () => {
  describe('Standard use cases', () => {
    it('should return the version from package.json', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));

      expect(getCliVersion()).toBe('1.2.3');
    });

    it('should read package.json as utf-8', () => {
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '0.1.0' }));

      getCliVersion();

      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        'utf-8',
      );
    });
  });

  describe('Edge cases', () => {
    it('should throw when package.json cannot be read', () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('ENOENT');
      });

      expect(() => getCliVersion()).toThrow();
    });
  });
});
