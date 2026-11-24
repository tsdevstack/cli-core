import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addCronScript } from './add-cron-script';

describe('addCronScript', () => {
  let dir: string;
  let packageJsonPath: string;

  const readScripts = (): Record<string, string> =>
    (
      JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
        scripts: Record<string, string>;
      }
    ).scripts;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-script-'));
    packageJsonPath = path.join(dir, 'package.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('Standard use cases', () => {
    it('should add the cron script next to the existing ones', () => {
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify({
          name: 'auth-service',
          scripts: { build: 'nest build' },
        }),
      );

      const result = addCronScript(packageJsonPath);

      expect(result).toEqual({ added: ['cron'], kept: [] });
      expect(readScripts()).toEqual({
        build: 'nest build',
        cron: 'nest start --entryFile cron --path tsconfig.cron.json --',
      });
      expect(fs.readFileSync(packageJsonPath, 'utf-8').endsWith('}\n')).toBe(
        true,
      );
    });

    it('should keep an existing cron script, whatever it runs', () => {
      fs.writeFileSync(
        packageJsonPath,
        JSON.stringify({ scripts: { cron: 'my own' } }),
      );

      const result = addCronScript(packageJsonPath);

      expect(result).toEqual({ added: [], kept: ['cron'] });
      expect(readScripts()).toEqual({ cron: 'my own' });
    });
  });

  describe('Edge cases', () => {
    it('should create the scripts section when there is none', () => {
      fs.writeFileSync(packageJsonPath, JSON.stringify({ name: 'x' }));

      addCronScript(packageJsonPath);

      expect(readScripts()).toEqual({
        cron: 'nest start --entryFile cron --path tsconfig.cron.json --',
      });
    });
  });
});
