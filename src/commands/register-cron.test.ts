/**
 * Tests for registerCron command
 */

import { describe, it, expect, rs, beforeEach } from '@rstest/core';

// Mock dependencies (not errors: the tests need the real CliError)
rs.mock('inquirer', { mock: true });
rs.mock('node:fs', { mock: true });
rs.mock('../utils/logger', { mock: true });
rs.mock('../utils/config', { mock: true });
rs.mock('../utils/paths', { mock: true });
rs.mock('../utils/cron', { mock: true });

import inquirer from 'inquirer';
import fs from 'node:fs';
import { logger } from '../utils/logger';
import { loadFrameworkConfig } from '../utils/config';
import { findProjectRoot } from '../utils/paths';
import {
  addCronScript,
  assertCronJobNameFree,
  buildCronJobEntry,
  scaffoldCronFiles,
  validateCronJobName,
} from '../utils/cron';
import { CliError } from '../utils/errors';
import { createMockFrameworkConfig } from '../test-fixtures/framework-config';
import { registerCron } from './register-cron';

const SHARED = ['src/cron.ts', 'src/cron.module.ts', 'tsconfig.cron.json'];

const entry = {
  name: 'usage-report',
  type: 'cron' as const,
  schedule: '0 3 * * *',
  targetService: 'auth-service',
  timeout: 600,
};

function infoLines(): string[] {
  return rs.mocked(logger.info).mock.calls.map(([line]) => String(line));
}

describe('registerCron', () => {
  beforeEach(() => {
    rs.resetAllMocks();
    rs.mocked(findProjectRoot).mockReturnValue('/project');
    rs.mocked(fs.existsSync).mockReturnValue(true);
    rs.mocked(loadFrameworkConfig).mockReturnValue(
      createMockFrameworkConfig({
        services: [
          { name: 'auth-service', type: 'nestjs', port: 3001 },
          { name: 'frontend', type: 'nextjs', port: 4000 },
        ],
      }),
    );
    rs.mocked(scaffoldCronFiles).mockReturnValue({
      created: [...SHARED, 'src/cron/usage-report.cron.ts'],
      kept: [],
      moduleCreated: true,
      handlerFile: 'src/cron/usage-report.cron.ts',
      className: 'UsageReportCron',
    });
    rs.mocked(addCronScript).mockReturnValue({ added: ['cron'], kept: [] });
    rs.mocked(buildCronJobEntry).mockReturnValue(entry);
  });

  describe('Service selection', () => {
    it('should throw when there is no NestJS service', async () => {
      rs.mocked(loadFrameworkConfig).mockReturnValue(
        createMockFrameworkConfig({
          services: [{ name: 'frontend', type: 'nextjs', port: 4000 }],
        }),
      );

      await expect(registerCron({})).rejects.toThrow(CliError);
      await expect(registerCron({})).rejects.toThrow(
        'No NestJS services found in framework config',
      );
    });

    it('should prompt for the service and the name when not given', async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedService: 'auth-service' })
        .mockResolvedValueOnce({ inputName: 'usage-report' });

      await registerCron({});

      expect(inquirer.prompt).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({
          type: 'select',
          name: 'selectedService',
          choices: [{ name: 'auth-service', value: 'auth-service' }],
        }),
      ]);
      expect(inquirer.prompt).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({ type: 'input', name: 'inputName' }),
      ]);
      expect(scaffoldCronFiles).toHaveBeenCalledWith(
        '/project/apps/auth-service',
        'auth-service',
        'usage-report',
      );
    });

    it("should answer the name prompt's validation with the validator's message", async () => {
      rs.mocked(inquirer.prompt)
        .mockResolvedValueOnce({ selectedService: 'auth-service' })
        .mockResolvedValueOnce({ inputName: 'usage-report' });
      rs.mocked(validateCronJobName).mockImplementation((name: string) => {
        if (name === 'Bad') throw new CliError('bad name', 'register-cron');
      });

      await registerCron({});

      const [questions] = rs.mocked(inquirer.prompt).mock
        .calls[1] as unknown as [
        Array<{ validate: (input: string) => true | string }>,
      ];
      expect(questions[0].validate('usage-report')).toBe(true);
      expect(questions[0].validate('Bad')).toBe('bad name');
    });

    it('should not prompt when service and name are given', async () => {
      await registerCron({ service: 'auth-service', name: 'usage-report' });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(validateCronJobName).toHaveBeenCalledWith('usage-report');
      expect(scaffoldCronFiles).toHaveBeenCalledWith(
        '/project/apps/auth-service',
        'auth-service',
        'usage-report',
      );
      expect(addCronScript).toHaveBeenCalledWith(
        '/project/apps/auth-service/package.json',
      );
    });

    it('should throw for an unknown service', async () => {
      await expect(
        registerCron({ service: 'missing-service', name: 'usage-report' }),
      ).rejects.toThrow(
        'Service "missing-service" not found in framework config',
      );
    });

    it('should throw for a service that is not NestJS', async () => {
      await expect(
        registerCron({ service: 'frontend', name: 'usage-report' }),
      ).rejects.toThrow(
        'Service "frontend" is not a NestJS service (type: nextjs)',
      );
    });

    it('should check the name is free across the project before writing anything', async () => {
      await registerCron({ service: 'auth-service', name: 'usage-report' });

      expect(assertCronJobNameFree).toHaveBeenCalledWith(
        '/project',
        'auth-service',
        'usage-report',
        expect.arrayContaining([
          expect.objectContaining({ name: 'auth-service' }),
        ]),
      );
      expect(
        rs.mocked(assertCronJobNameFree).mock.invocationCallOrder[0],
      ).toBeLessThan(rs.mocked(scaffoldCronFiles).mock.invocationCallOrder[0]);
    });

    it('should stop when the name is taken', async () => {
      rs.mocked(assertCronJobNameFree).mockImplementation(() => {
        throw new CliError(
          'Cron job name "usage-report" is taken',
          'register-cron',
        );
      });

      await expect(
        registerCron({ service: 'auth-service', name: 'usage-report' }),
      ).rejects.toThrow('Cron job name "usage-report" is taken');
      expect(scaffoldCronFiles).not.toHaveBeenCalled();
      expect(addCronScript).not.toHaveBeenCalled();
    });

    it("should throw when the service's package.json is missing", async () => {
      rs.mocked(fs.existsSync).mockReturnValue(false);

      await expect(
        registerCron({ service: 'auth-service', name: 'usage-report' }),
      ).rejects.toThrow('apps/auth-service/package.json not found');
      expect(scaffoldCronFiles).not.toHaveBeenCalled();
    });
  });

  describe('Output', () => {
    it('should list what was created, print the entry and the next steps', async () => {
      await registerCron({ service: 'auth-service', name: 'usage-report' });

      expect(logger.success).toHaveBeenCalledWith(
        'Registered cron job: usage-report (auth-service)',
      );
      const lines = infoLines();
      expect(lines).toContain('Created in apps/auth-service:');
      expect(lines).toContain('  src/cron/usage-report.cron.ts');
      expect(lines).toContain('  package.json script "cron"');
      expect(lines).toContain(JSON.stringify(entry, null, 2));
      expect(lines).toContain(
        '  1. Write the job in apps/auth-service/src/cron/usage-report.cron.ts: the run() method',
      );
      expect(lines).toContain(
        '  2. Try it locally: npx tsdevstack run-cron usage-report --service auth-service',
      );
      expect(lines.some((l) => l.includes('import { UsageReportCron }'))).toBe(
        false,
      );
    });

    it('should print the two lines to add when the module already existed', async () => {
      rs.mocked(scaffoldCronFiles).mockReturnValue({
        created: ['src/cron/cleanup.cron.ts'],
        kept: SHARED,
        moduleCreated: false,
        handlerFile: 'src/cron/cleanup.cron.ts',
        className: 'CleanupCron',
      });
      rs.mocked(addCronScript).mockReturnValue({ added: [], kept: ['cron'] });

      await registerCron({ service: 'auth-service', name: 'cleanup' });

      const lines = infoLines();
      expect(lines).toContain(
        'Add the handler to apps/auth-service/src/cron.module.ts:',
      );
      expect(lines).toContain(
        "  import { CleanupCron } from './cron/cleanup.cron';",
      );
      expect(lines).toContain('  CleanupCron,   (in the handlers list)');
      expect(lines).toContain(
        'Already in apps/auth-service, left as they are:',
      );
      expect(lines).toContain('  package.json script "cron"');
      expect(lines).toContain(
        '  2. Add the two lines above to src/cron.module.ts',
      );
    });

    it('should warn and overwrite nothing when the handler already exists', async () => {
      rs.mocked(scaffoldCronFiles).mockReturnValue({
        created: [],
        kept: [...SHARED, 'src/cron/usage-report.cron.ts'],
        moduleCreated: false,
        handlerFile: 'src/cron/usage-report.cron.ts',
        className: 'UsageReportCron',
      });
      rs.mocked(addCronScript).mockReturnValue({ added: [], kept: ['cron'] });

      await registerCron({ service: 'auth-service', name: 'usage-report' });

      expect(logger.success).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Cron job "usage-report" already has a handler in apps/auth-service; nothing was overwritten',
      );
      expect(infoLines().some((l) => l.includes('import { '))).toBe(false);
    });
  });
});
