import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { scaffoldWorkerFiles } from './scaffold-worker-files';
import { resolveCliAssetDir } from '../paths/resolve-cli-asset-dir';

describe('scaffoldWorkerFiles', () => {
  let serviceDir: string;

  beforeEach(() => {
    serviceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-scaffold-'));
  });

  afterEach(() => {
    fs.rmSync(serviceDir, { recursive: true, force: true });
  });

  describe('Standard use cases', () => {
    it('should create the three worker files from the CLI templates', () => {
      const result = scaffoldWorkerFiles(serviceDir);

      expect(result).toEqual({
        created: [
          'src/worker.ts',
          'src/worker.module.ts',
          'tsconfig.worker.json',
        ],
        kept: [],
      });
      expect(
        fs.readFileSync(path.join(serviceDir, 'src/worker.ts'), 'utf-8'),
      ).toContain('void startWorker(WorkerModule);');
      expect(
        fs.readFileSync(path.join(serviceDir, 'src/worker.module.ts'), 'utf-8'),
      ).toContain('export class WorkerModule {}');
      expect(
        fs.readFileSync(path.join(serviceDir, 'tsconfig.worker.json'), 'utf-8'),
      ).toContain('"extends": "./tsconfig.build.json"');
    });

    it('should never overwrite a file that is already there', () => {
      fs.mkdirSync(path.join(serviceDir, 'src'));
      fs.writeFileSync(path.join(serviceDir, 'src/worker.ts'), '// mine\n');

      const result = scaffoldWorkerFiles(serviceDir);

      expect(result.created).toEqual([
        'src/worker.module.ts',
        'tsconfig.worker.json',
      ]);
      expect(result.kept).toEqual(['src/worker.ts']);
      expect(
        fs.readFileSync(path.join(serviceDir, 'src/worker.ts'), 'utf-8'),
      ).toBe('// mine\n');
    });
  });

  describe('Edge cases', () => {
    it('should create nothing when every file exists', () => {
      scaffoldWorkerFiles(serviceDir);

      expect(scaffoldWorkerFiles(serviceDir)).toEqual({
        created: [],
        kept: ['src/worker.ts', 'src/worker.module.ts', 'tsconfig.worker.json'],
      });
    });

    it('should write each template as it is', () => {
      const templateDir = resolveCliAssetDir('worker');

      scaffoldWorkerFiles(serviceDir, templateDir);

      expect(
        fs.readFileSync(path.join(serviceDir, 'src/worker.module.ts'), 'utf-8'),
      ).toBe(
        fs.readFileSync(
          path.join(templateDir, 'worker.module.ts.template'),
          'utf-8',
        ),
      );
    });
  });
});
