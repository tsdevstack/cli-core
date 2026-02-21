import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { writeYamlFile } from './write-yaml-file';
import { CliError } from '../errors';
import * as fs from 'fs';

// Mock fs
rs.mock('fs', { mock: true });

describe('writeYamlFile', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should write data as YAML to file', () => {
    const data = { name: 'test', version: '1.0.0' };

    writeYamlFile('/path/to/output.yaml', data);

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      '/path/to/output.yaml',
      expect.stringContaining('name: test'),
      'utf-8',
    );
  });

  it('should use default indentation of 2 spaces', () => {
    const data = { outer: { inner: 'value' } };

    writeYamlFile('/path/to/file.yaml', data);

    const writtenContent = rs.mocked(fs.writeFileSync).mock
      .calls[0][1] as string;
    expect(writtenContent).toContain('outer:');
    expect(writtenContent).toContain('  inner: value');
  });

  it('should handle arrays', () => {
    const data = { items: ['one', 'two', 'three'] };

    writeYamlFile('/path/to/file.yaml', data);

    const writtenContent = rs.mocked(fs.writeFileSync).mock
      .calls[0][1] as string;
    expect(writtenContent).toContain('items:');
    expect(writtenContent).toContain('  - one');
    expect(writtenContent).toContain('  - two');
  });

  it('should accept custom dump options', () => {
    const data = { name: 'test' };

    writeYamlFile('/path/to/file.yaml', data, { indent: 4 });

    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('should throw CliError when write fails', () => {
    rs.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });

    expect(() => {
      writeYamlFile('/restricted/file.yaml', { name: 'test' });
    }).toThrow(CliError);
  });

  it('should include file path in error message on failure', () => {
    rs.mocked(fs.writeFileSync).mockImplementationOnce(() => {
      throw new Error('Write failed');
    });

    try {
      writeYamlFile('/bad/path.yaml', { name: 'test' });
      expect.fail('Should have thrown CliError');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('/bad/path.yaml');
      expect(cliError.context).toBe('YAML write failed');
    }
  });

  it('should handle complex nested structures', () => {
    const data = {
      services: [
        { name: 'auth', port: 3001 },
        { name: 'api', port: 3002 },
      ],
      config: {
        database: {
          host: 'localhost',
          port: 5432,
        },
      },
    };

    writeYamlFile('/path/to/complex.yaml', data);

    const writtenContent = rs.mocked(fs.writeFileSync).mock
      .calls[0][1] as string;
    expect(writtenContent).toContain('services:');
    expect(writtenContent).toContain('- name: auth');
    expect(writtenContent).toContain('config:');
    expect(writtenContent).toContain('database:');
  });
});
