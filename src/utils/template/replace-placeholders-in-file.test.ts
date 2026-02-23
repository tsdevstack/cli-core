import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockExistsSync, mockReadFileSync, mockWriteFileSync } = rs.hoisted(
  () => ({
    mockExistsSync: rs.fn(),
    mockReadFileSync: rs.fn(),
    mockWriteFileSync: rs.fn(),
  }),
);

rs.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));

import { replacePlaceholdersInFile } from './replace-placeholders-in-file';

describe('replacePlaceholdersInFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should replace all occurrences of each placeholder', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        '{{SERVICE_NAME}} by {{AUTHOR}} - {{SERVICE_NAME}}',
      );

      replacePlaceholdersInFile('/path/to/file.json', {
        '\\{\\{SERVICE_NAME\\}\\}': 'my-service',
        '\\{\\{AUTHOR\\}\\}': 'John',
      });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/path/to/file.json',
        'my-service by John - my-service',
        'utf-8',
      );
    });

    it('should handle a single replacement', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('name: {{NAME}}');

      replacePlaceholdersInFile('/path/to/file.txt', {
        '\\{\\{NAME\\}\\}': 'test-app',
      });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/path/to/file.txt',
        'name: test-app',
        'utf-8',
      );
    });

    it('should handle empty replacements map', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('unchanged content');

      replacePlaceholdersInFile('/path/to/file.txt', {});

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/path/to/file.txt',
        'unchanged content',
        'utf-8',
      );
    });
  });

  describe('Edge cases', () => {
    it('should skip silently when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      replacePlaceholdersInFile('/missing/file.txt', {
        '\\{\\{NAME\\}\\}': 'test',
      });

      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('should handle content with no matching placeholders', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('no placeholders here');

      replacePlaceholdersInFile('/path/to/file.txt', {
        '\\{\\{MISSING\\}\\}': 'value',
      });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/path/to/file.txt',
        'no placeholders here',
        'utf-8',
      );
    });
  });
});
