import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('../fs/read-json-file', () => ({
  readJsonFile: rs.fn(),
}));

import { loadOpenApiDocument } from './load-openapi-document';
import { readJsonFile } from '../fs/read-json-file';

describe('loadOpenApiDocument', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should load and return valid OpenAPI document', () => {
      const validDoc = {
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/health': { get: {} },
        },
      };
      rs.mocked(readJsonFile).mockReturnValue(validDoc);

      const result = loadOpenApiDocument('/path/to/openapi.json');

      expect(result).toEqual(validDoc);
      expect(readJsonFile).toHaveBeenCalledWith('/path/to/openapi.json');
    });
  });

  describe('Edge cases', () => {
    it('should throw when document is missing openapi field', () => {
      rs.mocked(readJsonFile).mockReturnValue({
        info: { title: 'Test', version: '1.0.0' },
        paths: {},
      });

      expect(() => {
        loadOpenApiDocument('/path/to/invalid.json');
      }).toThrow('Invalid OpenAPI document');
    });

    it('should throw when document is missing paths field', () => {
      rs.mocked(readJsonFile).mockReturnValue({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0.0' },
      });

      expect(() => {
        loadOpenApiDocument('/path/to/invalid.json');
      }).toThrow('Invalid OpenAPI document');
    });

    it('should include file path in error message', () => {
      rs.mocked(readJsonFile).mockReturnValue({
        info: { title: 'Test', version: '1.0.0' },
      });

      expect(() => {
        loadOpenApiDocument('/specific/path.json');
      }).toThrow('/specific/path.json');
    });

    it('should propagate readJsonFile errors', () => {
      rs.mocked(readJsonFile).mockImplementation(() => {
        throw new Error('File not found');
      });

      expect(() => {
        loadOpenApiDocument('/missing/file.json');
      }).toThrow('File not found');
    });
  });
});
