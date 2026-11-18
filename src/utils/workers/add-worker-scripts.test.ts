import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addWorkerScripts } from './add-worker-scripts';

describe('addWorkerScripts', () => {
  let dir: string;
  let packageJsonPath: string;

  function writePackage(pkg: Record<string, unknown>): void {
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
  }

  function readPackage(): { scripts?: Record<string, string> } {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
      scripts?: Record<string, string>;
    };
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-scripts-'));
    packageJsonPath = path.join(dir, 'package.json');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  describe('Standard use cases', () => {
    it('should add both worker scripts after the existing ones', () => {
      writePackage({ name: 'offers-service', scripts: { dev: 'nest start' } });

      const result = addWorkerScripts(packageJsonPath);

      expect(result).toEqual({
        added: ['start-worker:dev', 'start-worker'],
        kept: [],
      });
      expect(readPackage().scripts).toEqual({
        dev: 'nest start',
        'start-worker:dev':
          'nest start --entryFile worker --watch --path tsconfig.worker.json',
        'start-worker': 'node dist/worker.js',
      });
    });

    it('should leave a script that is already there as it is', () => {
      writePackage({
        name: 'offers-service',
        scripts: { 'start-worker': 'node dist/my-worker.js' },
      });

      const result = addWorkerScripts(packageJsonPath);

      expect(result).toEqual({
        added: ['start-worker:dev'],
        kept: ['start-worker'],
      });
      expect(readPackage().scripts?.['start-worker']).toBe(
        'node dist/my-worker.js',
      );
    });
  });

  describe('Edge cases', () => {
    it('should create the scripts section when there is none', () => {
      writePackage({ name: 'offers-service' });

      addWorkerScripts(packageJsonPath);

      expect(Object.keys(readPackage().scripts ?? {})).toEqual([
        'start-worker:dev',
        'start-worker',
      ]);
    });

    it('should not rewrite the file when both scripts exist', () => {
      const original =
        '{"name":"offers-service","scripts":{"start-worker:dev":"x","start-worker":"y"}}';
      fs.writeFileSync(packageJsonPath, original);

      expect(addWorkerScripts(packageJsonPath)).toEqual({
        added: [],
        kept: ['start-worker:dev', 'start-worker'],
      });
      expect(fs.readFileSync(packageJsonPath, 'utf-8')).toBe(original);
    });
  });
});
