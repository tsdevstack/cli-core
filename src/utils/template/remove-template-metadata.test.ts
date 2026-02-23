import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockReadPackageJsonFrom, mockWritePackageJson, mockLogger } =
  rs.hoisted(() => ({
    mockReadPackageJsonFrom: rs.fn(),
    mockWritePackageJson: rs.fn(),
    mockLogger: {
      success: rs.fn(),
      warn: rs.fn(),
    },
  }));

rs.mock('../fs', () => ({
  readPackageJsonFrom: mockReadPackageJsonFrom,
  writePackageJson: mockWritePackageJson,
}));
rs.mock('../logger', () => ({
  logger: mockLogger,
}));

import { removeTemplateMetadata } from './remove-template-metadata';

describe('removeTemplateMetadata', () => {
  const APP_PATH = '/fake/project/apps/my-service';

  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should remove repository, homepage, and bugs fields', () => {
      const packageJson = {
        name: 'my-service',
        version: '1.0.0',
        repository: { type: 'git', url: 'https://github.com/template' },
        homepage: 'https://github.com/template#readme',
        bugs: { url: 'https://github.com/template/issues' },
      };
      mockReadPackageJsonFrom.mockReturnValue(packageJson);

      removeTemplateMetadata(APP_PATH);

      expect(mockWritePackageJson).toHaveBeenCalledWith(APP_PATH, {
        name: 'my-service',
        version: '1.0.0',
      });
    });

    it('should log success after removing metadata', () => {
      mockReadPackageJsonFrom.mockReturnValue({
        name: 'my-service',
        repository: 'some-url',
      });

      removeTemplateMetadata(APP_PATH);

      expect(mockLogger.success).toHaveBeenCalledWith(
        'Template metadata removed from package.json',
      );
    });

    it('should handle package.json without metadata fields', () => {
      const packageJson = {
        name: 'my-service',
        version: '1.0.0',
      };
      mockReadPackageJsonFrom.mockReturnValue(packageJson);

      removeTemplateMetadata(APP_PATH);

      expect(mockWritePackageJson).toHaveBeenCalledWith(APP_PATH, {
        name: 'my-service',
        version: '1.0.0',
      });
    });
  });

  describe('Edge cases', () => {
    it('should warn when reading package.json fails', () => {
      mockReadPackageJsonFrom.mockImplementation(() => {
        throw new Error('File not found');
      });

      removeTemplateMetadata(APP_PATH);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Could not remove template metadata from package.json',
      );
      expect(mockWritePackageJson).not.toHaveBeenCalled();
    });

    it('should warn when writing package.json fails', () => {
      mockReadPackageJsonFrom.mockReturnValue({ name: 'my-service' });
      mockWritePackageJson.mockImplementation(() => {
        throw new Error('Write failed');
      });

      removeTemplateMetadata(APP_PATH);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Could not remove template metadata from package.json',
      );
    });
  });
});
