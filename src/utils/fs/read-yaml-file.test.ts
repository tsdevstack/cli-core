import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { readYamlFile } from './read-yaml-file';
import { CliError } from '../errors';
import * as fs from 'fs';

// Mock dependencies
rs.mock('fs', { mock: true });
rs.mock('./is-file', () => ({
  isFile: rs.fn(),
}));

import { isFile } from './is-file';

describe('readYamlFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should read and parse valid YAML file', () => {
    const yamlContent = 'name: test\nversion: 1.0.0';
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue(yamlContent);

    const result = readYamlFile('/path/to/file.yaml');

    expect(result).toEqual({ name: 'test', version: '1.0.0' });
    expect(isFile).toHaveBeenCalledWith('/path/to/file.yaml');
    expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/file.yaml', 'utf-8');
  });

  it('should throw CliError when file does not exist', () => {
    rs.mocked(isFile).mockReturnValue(false);

    expect(() => {
      readYamlFile('/path/to/nonexistent.yaml');
    }).toThrow(CliError);

    expect(fs.readFileSync).not.toHaveBeenCalled();
  });

  it('should include file path in error message when file not found', () => {
    rs.mocked(isFile).mockReturnValue(false);

    try {
      readYamlFile('/path/to/missing.yaml');
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('/path/to/missing.yaml');
      expect(cliError.context).toBe('YAML file not found');
    }
  });

  it('should throw CliError when YAML is invalid', () => {
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: content:');

    expect(() => {
      readYamlFile('/path/to/invalid.yaml');
    }).toThrow(CliError);
  });

  it('should parse nested YAML structures', () => {
    const yamlContent = `
services:
  - name: auth
    port: 3001
  - name: api
    port: 3002
config:
  nested:
    value: test
`;
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue(yamlContent);

    const result = readYamlFile<{
      services: Array<{ name: string; port: number }>;
      config: { nested: { value: string } };
    }>('/path/to/nested.yaml');

    expect(result.services).toHaveLength(2);
    expect(result.services[0].name).toBe('auth');
    expect(result.config.nested.value).toBe('test');
  });

  it('should support generic type parameter', () => {
    interface Config {
      name: string;
      enabled: boolean;
    }

    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue('name: test\nenabled: true');

    const result = readYamlFile<Config>('/path/to/config.yaml');

    expect(result.name).toBe('test');
    expect(result.enabled).toBe(true);
  });

  it('should parse arrays in YAML', () => {
    const yamlContent = `
items:
  - one
  - two
  - three
`;
    rs.mocked(isFile).mockReturnValue(true);
    rs.mocked(fs.readFileSync).mockReturnValue(yamlContent);

    const result = readYamlFile<{ items: string[] }>('/path/to/list.yaml');

    expect(result.items).toEqual(['one', 'two', 'three']);
  });
});
