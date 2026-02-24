import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockReplacePlaceholdersInFile } = rs.hoisted(() => ({
  mockReplacePlaceholdersInFile: rs.fn(),
}));

rs.mock('../template', () => ({
  replacePlaceholdersInFile: mockReplacePlaceholdersInFile,
}));

import { replaceMonorepoPlaceholders } from './replace-monorepo-placeholders';

describe('replaceMonorepoPlaceholders', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should replace placeholders in package.json, config.json, and README.md', () => {
      replaceMonorepoPlaceholders('/fake/project', 'my-app', '1.0.0');

      expect(mockReplacePlaceholdersInFile).toHaveBeenCalledTimes(3);
    });

    it('should pass PROJECT_NAME and CLI_VERSION replacements', () => {
      replaceMonorepoPlaceholders('/fake/project', 'my-app', '1.0.0');

      const firstCallReplacements =
        mockReplacePlaceholdersInFile.mock.calls[0][1];
      expect(firstCallReplacements).toEqual({
        '\\{\\{PROJECT_NAME\\}\\}': 'my-app',
        '\\{\\{CLI_VERSION\\}\\}': '^1.0.0',
      });
    });

    it('should process package.json at project root', () => {
      replaceMonorepoPlaceholders('/fake/project', 'my-app', '1.0.0');

      expect(mockReplacePlaceholdersInFile).toHaveBeenCalledWith(
        expect.stringContaining('package.json'),
        expect.any(Object),
      );
    });

    it('should process .tsdevstack/config.json', () => {
      replaceMonorepoPlaceholders('/fake/project', 'my-app', '1.0.0');

      const paths = mockReplacePlaceholdersInFile.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(paths).toContainEqual(expect.stringContaining('config.json'));
    });

    it('should process README.md', () => {
      replaceMonorepoPlaceholders('/fake/project', 'my-app', '1.0.0');

      const paths = mockReplacePlaceholdersInFile.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(paths).toContainEqual(expect.stringContaining('README.md'));
    });
  });
});
