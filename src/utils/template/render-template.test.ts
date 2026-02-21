import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { CliError } from '../errors';

const {
  mockExistsSync,
  mockReadFileSync,
  mockWriteFileSync,
  mockEnsureDirectory,
  mockLogger,
} = rs.hoisted(() => ({
  mockExistsSync: rs.fn(),
  mockReadFileSync: rs.fn(),
  mockWriteFileSync: rs.fn(),
  mockEnsureDirectory: rs.fn(),
  mockLogger: {
    success: rs.fn(),
  },
}));

rs.mock('fs', () => ({
  existsSync: mockExistsSync,
  readFileSync: mockReadFileSync,
  writeFileSync: mockWriteFileSync,
}));
rs.mock('../fs', () => ({
  ensureDirectory: mockEnsureDirectory,
}));
rs.mock('../logger', () => ({
  logger: mockLogger,
}));

import { renderTemplate } from './render-template';

describe('renderTemplate', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should render template and write output', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('Hello {{name}}!');

      renderTemplate('/templates/greeting.hbs', '/output/greeting.ts', {
        name: 'World',
      });

      expect(mockReadFileSync).toHaveBeenCalledWith(
        '/templates/greeting.hbs',
        'utf-8',
      );
      expect(mockEnsureDirectory).toHaveBeenCalledWith('/output');
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/output/greeting.ts',
        'Hello World!',
        'utf-8',
      );
    });

    it('should log success by default', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('content');

      renderTemplate('/templates/file.hbs', '/output/file.ts');

      expect(mockLogger.success).toHaveBeenCalledWith('Created file.ts');
    });

    it('should not log when silent is true', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('content');

      renderTemplate('/templates/file.hbs', '/output/file.ts', {}, true);

      expect(mockLogger.success).not.toHaveBeenCalled();
    });

    it('should render with empty data when data is undefined', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('Static content');

      renderTemplate('/templates/static.hbs', '/output/static.ts');

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/output/static.ts',
        'Static content',
        'utf-8',
      );
    });

    it('should render template with multiple variables', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('{{className}} extends {{baseClass}}');

      renderTemplate('/templates/class.hbs', '/output/class.ts', {
        className: 'MyService',
        baseClass: 'BaseService',
      });

      expect(mockWriteFileSync).toHaveBeenCalledWith(
        '/output/class.ts',
        'MyService extends BaseService',
        'utf-8',
      );
    });

    it('should ensure output directory exists', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('content');

      renderTemplate('/templates/file.hbs', '/deep/nested/output/file.ts');

      expect(mockEnsureDirectory).toHaveBeenCalledWith('/deep/nested/output');
    });
  });

  describe('Error handling', () => {
    it('should throw CliError when template file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      expect(() =>
        renderTemplate('/missing/template.hbs', '/output/file.ts'),
      ).toThrow(CliError);
    });

    it('should include template path in error message', () => {
      mockExistsSync.mockReturnValue(false);

      try {
        renderTemplate('/missing/template.hbs', '/output/file.ts');
        expect.fail('Should have thrown');
      } catch (error) {
        const cliError = error as CliError;
        expect(cliError.message).toContain('/missing/template.hbs');
        expect(cliError.context).toBe('Template error');
      }
    });

    it('should not read or write when template does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      try {
        renderTemplate('/missing/template.hbs', '/output/file.ts');
      } catch {
        // expected
      }

      expect(mockReadFileSync).not.toHaveBeenCalled();
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });
});
