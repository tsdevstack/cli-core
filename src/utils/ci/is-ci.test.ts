import { describe, it, expect, beforeEach, afterEach } from '@rstest/core';
import { isCIEnv } from './is-ci';

describe('isCIEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return true when CI is "true"', () => {
    process.env.CI = 'true';
    expect(isCIEnv()).toBe(true);
  });

  it('should return false when CI is not set', () => {
    delete process.env.CI;
    expect(isCIEnv()).toBe(false);
  });

  it('should return false when CI is "false"', () => {
    process.env.CI = 'false';
    expect(isCIEnv()).toBe(false);
  });

  it('should return false when CI is "1"', () => {
    process.env.CI = '1';
    expect(isCIEnv()).toBe(false);
  });
});
