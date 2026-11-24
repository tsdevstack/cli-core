import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { scaffoldCronFiles } from './scaffold-cron-files';

const SHARED = ['src/cron.ts', 'src/cron.module.ts', 'tsconfig.cron.json'];

describe('scaffoldCronFiles', () => {
  let serviceDir: string;

  const read = (file: string): string =>
    fs.readFileSync(path.join(serviceDir, file), 'utf-8');

  beforeEach(() => {
    serviceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-scaffold-'));
  });

  afterEach(() => {
    fs.rmSync(serviceDir, { recursive: true, force: true });
  });

  describe('The first cron job of a service', () => {
    it('should create the three shared files and the handler from the CLI templates', () => {
      const result = scaffoldCronFiles(
        serviceDir,
        'auth-service',
        'usage-report',
      );

      expect(result).toEqual({
        created: [...SHARED, 'src/cron/usage-report.cron.ts'],
        kept: [],
        moduleCreated: true,
        handlerFile: 'src/cron/usage-report.cron.ts',
        className: 'UsageReportCron',
      });
      expect(read('src/cron.ts')).toContain(
        'void runCronJob(CronModule, process.argv[2]);',
      );
      expect(read('tsconfig.cron.json')).toContain(
        '"outDir": "./node_modules/.cache/cron-dev"',
      );
    });

    it('should list the handler in the module', () => {
      scaffoldCronFiles(serviceDir, 'auth-service', 'usage-report');

      const module = read('src/cron.module.ts');
      expect(module).toContain(
        "import { UsageReportCron } from './cron/usage-report.cron';",
      );
      expect(module).toContain('const handlers = [UsageReportCron];');
      expect(module).toContain('providers: provideCronJobs(handlers)');
      expect(module).toContain('RedisModule,');
      expect(module).not.toContain('PrismaModule');
    });

    it('should import the Prisma module when the service has one', () => {
      fs.mkdirSync(path.join(serviceDir, 'src/prisma'), { recursive: true });
      fs.writeFileSync(
        path.join(serviceDir, 'src/prisma/prisma.module.ts'),
        '',
      );

      scaffoldCronFiles(serviceDir, 'auth-service', 'usage-report');

      const module = read('src/cron.module.ts');
      expect(module).toContain(
        "import { PrismaModule } from './prisma/prisma.module';",
      );
      expect(module).toContain('    RedisModule,\n    PrismaModule,\n  ],');
    });

    it('should write the handler with its name, class and local run command', () => {
      scaffoldCronFiles(serviceDir, 'auth-service', 'usage-report');

      const handler = read('src/cron/usage-report.cron.ts');
      expect(handler).toContain(
        'export class UsageReportCron implements CronJobHandler',
      );
      expect(handler).toContain("readonly name = 'usage-report';");
      expect(handler).toContain(
        'async run(signal: AbortSignal): Promise<void>',
      );
      expect(handler).toContain(
        'npx tsdevstack run-cron usage-report --service auth-service',
      );
    });

    it('should leave no placeholder in any file', () => {
      const result = scaffoldCronFiles(
        serviceDir,
        'auth-service',
        'usage-report',
      );

      for (const file of result.created) {
        expect(read(file)).not.toMatch(/\{\{/);
      }
    });
  });

  describe('A later cron job of the service', () => {
    it('should create the handler only and keep the shared files as they are', () => {
      scaffoldCronFiles(serviceDir, 'auth-service', 'usage-report');
      const moduleBefore = read('src/cron.module.ts');

      const result = scaffoldCronFiles(serviceDir, 'auth-service', 'cleanup');

      expect(result).toEqual({
        created: ['src/cron/cleanup.cron.ts'],
        kept: SHARED,
        moduleCreated: false,
        handlerFile: 'src/cron/cleanup.cron.ts',
        className: 'CleanupCron',
      });
      expect(read('src/cron.module.ts')).toBe(moduleBefore);
      expect(read('src/cron/cleanup.cron.ts')).toContain(
        "readonly name = 'cleanup';",
      );
    });
  });

  describe('Edge cases', () => {
    it('should never overwrite an existing handler', () => {
      fs.mkdirSync(path.join(serviceDir, 'src/cron'), { recursive: true });
      fs.writeFileSync(
        path.join(serviceDir, 'src/cron/usage-report.cron.ts'),
        '// mine\n',
      );

      const result = scaffoldCronFiles(
        serviceDir,
        'auth-service',
        'usage-report',
      );

      expect(result.created).toEqual(SHARED);
      expect(result.kept).toEqual(['src/cron/usage-report.cron.ts']);
      expect(read('src/cron/usage-report.cron.ts')).toBe('// mine\n');
    });

    it('should create nothing when every file exists', () => {
      scaffoldCronFiles(serviceDir, 'auth-service', 'usage-report');

      const result = scaffoldCronFiles(
        serviceDir,
        'auth-service',
        'usage-report',
      );

      expect(result.created).toEqual([]);
      expect(result.kept).toEqual([...SHARED, 'src/cron/usage-report.cron.ts']);
      expect(result.moduleCreated).toBe(false);
    });
  });
});
