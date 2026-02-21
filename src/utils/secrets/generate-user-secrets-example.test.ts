import { describe, it, expect } from '@rstest/core';
import { generateUserSecretsExample } from './generate-user-secrets-example';
import type { SecretsFile } from './types';

describe('generateUserSecretsExample', () => {
  it('should strip string values to empty strings', () => {
    const input: SecretsFile = {
      secrets: {
        API_KEY: 'secret-key-123',
        JWT_SECRET: 'jwt-secret-456',
      },
    };

    const result = generateUserSecretsExample(input);

    expect(result.secrets.API_KEY).toBe('');
    expect(result.secrets.JWT_SECRET).toBe('');
  });

  it('should set example $comment', () => {
    const input: SecretsFile = {
      $comment: 'original comment',
      secrets: { KEY: 'value' },
    };

    const result = generateUserSecretsExample(input);

    expect(result.$comment).toBe(
      'Example user secrets - copy values to .secrets.user.json or run: npx tsdevstack generate-secrets',
    );
  });

  it('should preserve $ metadata fields other than $comment', () => {
    const input: SecretsFile = {
      $comment: 'original',
      $warning: 'do not edit',
      secrets: { KEY: 'value' },
    };

    const result = generateUserSecretsExample(input);

    expect(result.$warning).toBe('do not edit');
  });

  it('should recursively strip nested objects', () => {
    const input: SecretsFile = {
      secrets: { KEY: 'value' },
      'auth-service': {
        DATABASE_URL: 'postgres://...',
        API_KEY: 'abc123',
      },
    };

    const result = generateUserSecretsExample(input);
    const authService = result['auth-service'] as Record<string, string>;

    expect(authService.DATABASE_URL).toBe('');
    expect(authService.API_KEY).toBe('');
  });

  it('should preserve arrays as-is', () => {
    const input: SecretsFile = {
      secrets: { KEY: 'value' },
      'auth-service': {
        secrets: ['KEY1', 'KEY2'],
        API_KEY: 'abc',
      },
    };

    const result = generateUserSecretsExample(input);
    const authService = result['auth-service'] as Record<string, unknown>;

    expect(authService.secrets).toEqual(['KEY1', 'KEY2']);
  });

  it('should not mutate the original object', () => {
    const input: SecretsFile = {
      secrets: { KEY: 'original-value' },
    };

    generateUserSecretsExample(input);

    expect(input.secrets.KEY).toBe('original-value');
  });
});
