import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { findCronHandlerServices } from './find-cron-handler-services';

describe('findCronHandlerServices', () => {
  let root: string;

  const addHandler = (service: string, job: string): void => {
    const dir = path.join(root, 'apps', service, 'src/cron');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${job}.cron.ts`), '');
  };

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cron-find-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should name the NestJS services that have the handler file', () => {
    addHandler('auth-service', 'report');
    addHandler('bff-service', 'other');
    const services = [
      { name: 'auth-service', type: 'nestjs' },
      { name: 'bff-service', type: 'nestjs' },
      { name: 'offers-service', type: 'nestjs' },
    ];

    expect(findCronHandlerServices(root, 'report', services)).toEqual([
      'auth-service',
    ]);
    expect(findCronHandlerServices(root, 'other', services)).toEqual([
      'bff-service',
    ]);
    expect(findCronHandlerServices(root, 'none', services)).toEqual([]);
  });

  it('should ignore a service that is not NestJS', () => {
    addHandler('frontend', 'report');

    expect(
      findCronHandlerServices(root, 'report', [
        { name: 'frontend', type: 'nextjs' },
      ]),
    ).toEqual([]);
  });
});
