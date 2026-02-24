import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import { join } from 'path';
import { scaffoldAuthServiceClient } from './scaffold-auth-service-client';

describe('scaffoldAuthServiceClient', () => {
  const tmpDir = join(__dirname, '__test-tmp-client__');

  beforeEach(() => {
    fs.mkdirSync(join(tmpDir, 'packages'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('should create the auth-service-client package directory', () => {
    scaffoldAuthServiceClient(tmpDir);

    const clientDir = join(tmpDir, 'packages', 'auth-service-client');
    expect(fs.existsSync(clientDir)).toBe(true);
  });

  it('should create a valid package.json with correct name', () => {
    scaffoldAuthServiceClient(tmpDir);

    const pkgPath = join(
      tmpDir,
      'packages',
      'auth-service-client',
      'package.json',
    );
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    expect(pkg.name).toBe('@shared/auth-service-client');
    expect(pkg.private).toBe(true);
  });

  it('should create a stub index.ts', () => {
    scaffoldAuthServiceClient(tmpDir);

    const indexPath = join(
      tmpDir,
      'packages',
      'auth-service-client',
      'src',
      'index.ts',
    );
    expect(fs.existsSync(indexPath)).toBe(true);
    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain('export {}');
  });

  it('should create a tsconfig.json', () => {
    scaffoldAuthServiceClient(tmpDir);

    const tsconfigPath = join(
      tmpDir,
      'packages',
      'auth-service-client',
      'tsconfig.json',
    );
    expect(fs.existsSync(tsconfigPath)).toBe(true);
  });
});
