/**
 * The cron job constants live in three packages that cannot import each
 * other at run time: nest-common (the runner), cli-core (the scaffold and
 * the local run) and infra-core (validation, schema, deploys). This test
 * keeps the twins equal: a drift would fail silently, as a renamed env var
 * that never reaches the runner.
 */

import { describe, it, expect } from '@rstest/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as infraCore from '@tsdevstack/infra-core';
import {
  CRON_ENTRY_FILE,
  CRON_EXIT_NOT_STARTED,
  CRON_HANDLER_DIR,
  CRON_HANDLER_SUFFIX,
  CRON_JOB_NAME_MAX_LENGTH,
  CRON_JOB_NAME_PATTERN,
  CRON_JOB_TYPE,
  CRON_SCRIPTS,
  DEFAULT_CRON_JOB_TIMEOUT_SECONDS,
} from './cron';
import { APPS_DIR } from './paths';

/** nest-common's constants file, read as text: `export const NAME = value;` */
function nestCommonConstants(): Record<string, string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(
    here,
    '../../../nest-common/src/cron/cron.constants.ts',
  );
  const text = fs.readFileSync(file, 'utf-8');
  const values: Record<string, string> = {};
  for (const match of text.matchAll(/export const ([A-Z_]+)\s*=\s*([^;]+);/g)) {
    values[match[1]] = match[2].trim();
  }
  return values;
}

describe('cron constants across the packages', () => {
  const nestCommon = nestCommonConstants();

  it('should use the same env names in nest-common and infra-core', () => {
    expect(nestCommon.CRON_JOB_NAME_ENV).toBe(
      `'${infraCore.CRON_JOB_NAME_ENV}'`,
    );
    expect(nestCommon.CRON_JOB_TIMEOUT_ENV).toBe(
      `'${infraCore.CRON_JOB_TIMEOUT_ENV}'`,
    );
  });

  it('should write and read the same finished line', () => {
    expect(nestCommon.CRON_FINISHED_MESSAGE).toBe(
      `'${infraCore.CRON_FINISHED_MESSAGE}'`,
    );
  });

  it('should assume the same default timeout everywhere', () => {
    expect(nestCommon.DEFAULT_CRON_JOB_TIMEOUT_SECONDS).toBe(
      String(DEFAULT_CRON_JOB_TIMEOUT_SECONDS),
    );
    for (const provider of ['gcp', 'aws', 'azure'] as const) {
      expect(infraCore.CRON_JOB_TIMEOUT[provider].default).toBe(
        DEFAULT_CRON_JOB_TIMEOUT_SECONDS,
      );
    }
  });

  it('should mean the same by exit 2', () => {
    expect(nestCommon.CRON_EXIT_UNKNOWN_JOB).toBe(
      String(CRON_EXIT_NOT_STARTED),
    );
  });

  it('should put the code in the same files in cli-core and infra-core', () => {
    expect(infraCore.CRON_ENTRY_FILE).toBe(CRON_ENTRY_FILE);
    expect(infraCore.CRON_HANDLER_DIR).toBe(CRON_HANDLER_DIR);
    expect(infraCore.CRON_HANDLER_SUFFIX).toBe(CRON_HANDLER_SUFFIX);
    expect(infraCore.APPS_DIR).toBe(APPS_DIR);
  });

  it('should run the same command locally and in the cloud', () => {
    // The local script compiles into its own folder; the entry file is the same
    expect(CRON_SCRIPTS.cron).toContain('--entryFile cron');
    expect(infraCore.CRON_JOB_COMMAND).toEqual(['node', 'dist/cron.js']);
    expect(CRON_ENTRY_FILE).toBe('src/cron.ts');
  });

  it('should name the kind the same way', () => {
    expect(infraCore.CRON_JOB_TYPE).toBe(CRON_JOB_TYPE);
  });

  it('should apply the same name rule in register-cron and in the validation', () => {
    expect(infraCore.CRON_JOB_NAME_PATTERN.source).toBe(
      CRON_JOB_NAME_PATTERN.source,
    );
    expect(infraCore.CRON_JOB_NAME_MAX_LENGTH).toBe(CRON_JOB_NAME_MAX_LENGTH);
  });
});
