import { describe, it, expect } from '@rstest/core';
import * as path from 'path';
import { CliPaths, getCliPaths } from './cli-paths';

describe('CliPaths', () => {
  const cliDir = '/usr/local/cli';

  describe('templatesDir', () => {
    it('should return templates subdirectory', () => {
      const paths = new CliPaths(cliDir);
      expect(paths.templatesDir).toBe(path.join(cliDir, 'templates'));
    });
  });

  describe('swaggerTemplatesDir', () => {
    it('should return swagger-ts-templates subdirectory', () => {
      const paths = new CliPaths(cliDir);
      expect(paths.swaggerTemplatesDir).toBe(
        path.join(cliDir, 'swagger-ts-templates'),
      );
    });
  });

  describe('getTemplate', () => {
    it('should return path to specific template', () => {
      const paths = new CliPaths(cliDir);
      expect(paths.getTemplate('nestjs')).toBe(
        path.join(cliDir, 'templates', 'nestjs'),
      );
    });
  });
});

describe('getCliPaths', () => {
  it('should return a CliPaths instance', () => {
    const paths = getCliPaths('/some/dir');
    expect(paths).toBeInstanceOf(CliPaths);
  });

  it('should use provided directory', () => {
    const paths = getCliPaths('/my/cli');
    expect(paths.templatesDir).toBe(path.join('/my/cli', 'templates'));
  });
});
