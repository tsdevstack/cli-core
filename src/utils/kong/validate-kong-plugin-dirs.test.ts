import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { validateKongPluginDirs } from './validate-kong-plugin-dirs';
import { CliError } from '../errors';

describe('validateKongPluginDirs', () => {
  let tempDir: string;

  const makePlugin = (name: string, files: string[]): string => {
    const dir = path.join(tempDir, name);
    fs.mkdirSync(dir, { recursive: true });
    for (const file of files) {
      fs.writeFileSync(path.join(dir, file), '');
    }
    return dir;
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'validate-kong-plugins-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Standard use cases', () => {
    it('should accept valid plugin folders', () => {
      const names = ['my-plugin', 'my_plugin', 'plugin2', 'a-b_c'];
      expect(() =>
        validateKongPluginDirs(
          names.map((name) => ({
            name,
            dir: makePlugin(name, ['handler.lua', 'schema.lua']),
          })),
        ),
      ).not.toThrow();
    });

    it('should accept an empty list', () => {
      expect(() => validateKongPluginDirs([])).not.toThrow();
    });
  });

  describe('Invalid folders', () => {
    it.each([
      ['My-Plugin'],
      ['my plugin'],
      ['my,plugin'],
      ['-plugin'],
      ['plugin-'],
      ['my--plugin'],
      ['my.plugin'],
    ])('should reject the name %s', (name) => {
      const dir = makePlugin(name, ['handler.lua', 'schema.lua']);
      expect(() => validateKongPluginDirs([{ name, dir }])).toThrow(
        /invalid plugin name/,
      );
    });

    it('should reject a folder without handler.lua', () => {
      const dir = makePlugin('no-handler', ['schema.lua']);
      expect(() =>
        validateKongPluginDirs([{ name: 'no-handler', dir }]),
      ).toThrow(/missing handler\.lua/);
    });

    it('should reject a folder without schema.lua', () => {
      const dir = makePlugin('no-schema', ['handler.lua']);
      expect(() =>
        validateKongPluginDirs([{ name: 'no-schema', dir }]),
      ).toThrow(/missing schema\.lua/);
    });

    it('should report every problem in one CliError with a hint', () => {
      const plugins = [
        { name: 'Bad', dir: makePlugin('Bad', ['handler.lua', 'schema.lua']) },
        { name: 'empty', dir: makePlugin('empty', []) },
        { name: 'ok', dir: makePlugin('ok', ['handler.lua', 'schema.lua']) },
      ];

      let error: unknown;
      try {
        validateKongPluginDirs(plugins);
      } catch (e) {
        error = e;
      }

      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('invalid plugin name "Bad"');
      expect(cliError.message).toContain(
        `${plugins[1].dir}: missing handler.lua, schema.lua`,
      );
      expect(cliError.message).not.toContain(plugins[2].dir + ':');
      expect(cliError.hint).toContain('kong-plugins/');
      expect(cliError.hint).toContain('handler.lua and schema.lua');
    });
  });
});
