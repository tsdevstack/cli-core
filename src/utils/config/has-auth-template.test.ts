import { describe, it, expect } from '@rstest/core';
import { hasAuthTemplate } from './has-auth-template';
import type { FrameworkConfig } from './types';

function makeConfig(template?: string | null): FrameworkConfig {
  return {
    project: { name: 'test', version: '1.0.0' },
    cloud: { provider: null },
    services: [],
    framework: {
      template: template as FrameworkConfig['framework'] extends {
        template?: infer T;
      }
        ? T
        : never,
    },
  };
}

describe('hasAuthTemplate', () => {
  it('should return true for fullstack-auth template', () => {
    expect(hasAuthTemplate(makeConfig('fullstack-auth'))).toBe(true);
  });

  it('should return true for auth template', () => {
    expect(hasAuthTemplate(makeConfig('auth'))).toBe(true);
  });

  it('should return false for null template', () => {
    expect(hasAuthTemplate(makeConfig(null))).toBe(false);
  });

  it('should return false when framework is undefined', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: null },
      services: [],
    };
    expect(hasAuthTemplate(config)).toBe(false);
  });

  it('should return false when template is undefined', () => {
    const config: FrameworkConfig = {
      project: { name: 'test', version: '1.0.0' },
      cloud: { provider: null },
      services: [],
      framework: {},
    };
    expect(hasAuthTemplate(config)).toBe(false);
  });
});
