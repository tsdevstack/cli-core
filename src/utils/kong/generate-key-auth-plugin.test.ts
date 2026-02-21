import { describe, it, expect } from '@rstest/core';
import { generateKeyAuthPlugin } from './generate-key-auth-plugin';
import type { KeyAuthPluginConfig } from './plugin-types';

describe('generateKeyAuthPlugin', () => {
  describe('Basic plugin generation', () => {
    it('should generate key-auth plugin with correct structure', () => {
      const result = generateKeyAuthPlugin();

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('config');
      expect(result.name).toBe('key-auth');
    });

    it('should set key_names to x-api-key header', () => {
      const result = generateKeyAuthPlugin();

      expect(result.config.key_names).toEqual(['x-api-key']);
    });

    it('should set hide_credentials to false', () => {
      const result = generateKeyAuthPlugin();

      expect(result.config.hide_credentials).toBe(false);
    });
  });

  describe('Plugin configuration values', () => {
    it('should have correct name property', () => {
      const result = generateKeyAuthPlugin();

      expect(result.name).toBe('key-auth');
    });

    it('should have all required config properties', () => {
      const result = generateKeyAuthPlugin();

      expect(result.config).toHaveProperty('key_names');
      expect(result.config).toHaveProperty('hide_credentials');
    });

    it('should use consistent configuration across calls', () => {
      const result1 = generateKeyAuthPlugin();
      const result2 = generateKeyAuthPlugin();

      expect(result1).toEqual(result2);
    });

    it('should have key_names as array', () => {
      const result = generateKeyAuthPlugin();

      expect(Array.isArray(result.config.key_names)).toBe(true);
      expect(result.config.key_names).toHaveLength(1);
    });

    it('should use x-api-key as header name', () => {
      const result = generateKeyAuthPlugin();

      expect(result.config.key_names[0]).toBe('x-api-key');
    });

    it('should not hide credentials in logs', () => {
      const result = generateKeyAuthPlugin();

      // hide_credentials: false means API keys are visible in Kong logs (useful for debugging)
      expect(result.config.hide_credentials).toBe(false);
    });
  });

  describe('Return value structure', () => {
    it('should match KeyAuthPluginConfig type structure', () => {
      const result = generateKeyAuthPlugin();

      // TypeScript will ensure this at compile time, but we verify at runtime too
      const plugin: KeyAuthPluginConfig = result;
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('key-auth');
    });

    it('should return new object on each call', () => {
      const result1 = generateKeyAuthPlugin();
      const result2 = generateKeyAuthPlugin();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });

    it('should return object with only expected properties', () => {
      const result = generateKeyAuthPlugin();

      const expectedKeys = ['name', 'config'];
      expect(Object.keys(result)).toEqual(expectedKeys);
    });

    it('should return config with only expected properties', () => {
      const result = generateKeyAuthPlugin();

      const expectedConfigKeys = ['key_names', 'hide_credentials'];
      expect(Object.keys(result.config).sort()).toEqual(
        expectedConfigKeys.sort(),
      );
    });
  });

  describe('Consistency', () => {
    it('should generate identical plugin on multiple calls', () => {
      const result1 = generateKeyAuthPlugin();
      const result2 = generateKeyAuthPlugin();
      const result3 = generateKeyAuthPlugin();

      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });

    it('should always return same key_names array content', () => {
      const results = Array.from({ length: 5 }, () => generateKeyAuthPlugin());

      results.forEach((result) => {
        expect(result.config.key_names).toEqual(['x-api-key']);
      });
    });

    it('should always return same hide_credentials value', () => {
      const results = Array.from({ length: 5 }, () => generateKeyAuthPlugin());

      results.forEach((result) => {
        expect(result.config.hide_credentials).toBe(false);
      });
    });
  });

  describe('Real-world scenarios', () => {
    it('should generate plugin for partner API endpoints', () => {
      const result = generateKeyAuthPlugin();

      expect(result).toEqual({
        name: 'key-auth',
        config: {
          key_names: ['x-api-key'],
          hide_credentials: false,
        },
      });
    });

    it('should be usable in Kong service configuration', () => {
      const plugin = generateKeyAuthPlugin();

      // Simulate Kong service with key-auth plugin
      const kongService = {
        name: 'partner-service',
        url: 'http://backend:3000',
        routes: [
          {
            name: 'partner-route',
            paths: ['/api/partners'],
          },
        ],
        plugins: [plugin],
      };

      expect(kongService.plugins[0]).toEqual(plugin);
      expect(kongService.plugins[0].name).toBe('key-auth');
    });

    it('should work with x-api-key header format', () => {
      const plugin = generateKeyAuthPlugin();

      // Verify the header name matches standard API key header convention
      expect(plugin.config.key_names[0]).toBe('x-api-key');

      // This is the standard header name used in HTTP requests:
      // curl -H "x-api-key: sk_live_abc123" https://api.example.com/api/endpoint
    });
  });

  describe('Configuration rationale', () => {
    it('should not hide credentials for debugging purposes', () => {
      const result = generateKeyAuthPlugin();

      // hide_credentials: false allows seeing API keys in Kong logs
      // This is useful for development and debugging
      // In production, logs should be secured appropriately
      expect(result.config.hide_credentials).toBe(false);
    });

    it('should use x-api-key as standard header name', () => {
      const result = generateKeyAuthPlugin();

      // x-api-key is a widely-used convention for API key authentication
      // Examples: Stripe, SendGrid, many other APIs use this header name
      expect(result.config.key_names).toContain('x-api-key');
    });

    it('should support single header name only', () => {
      const result = generateKeyAuthPlugin();

      // Framework standardizes on x-api-key header only
      // This keeps the API surface simple and consistent
      expect(result.config.key_names).toHaveLength(1);
    });
  });

  describe('Type safety', () => {
    it('should have correct return type', () => {
      const result: KeyAuthPluginConfig = generateKeyAuthPlugin();

      expect(result.name).toBe('key-auth');
      expect(result.config.key_names).toBeInstanceOf(Array);
      expect(typeof result.config.hide_credentials).toBe('boolean');
    });

    it('should have string array for key_names', () => {
      const result = generateKeyAuthPlugin();

      result.config.key_names.forEach((name) => {
        expect(typeof name).toBe('string');
      });
    });

    it('should have boolean for hide_credentials', () => {
      const result = generateKeyAuthPlugin();

      expect(typeof result.config.hide_credentials).toBe('boolean');
    });
  });

  describe('Immutability', () => {
    it('should return new config object on each call', () => {
      const result1 = generateKeyAuthPlugin();
      const result2 = generateKeyAuthPlugin();

      expect(result1.config).not.toBe(result2.config);
    });

    it('should return new key_names array on each call', () => {
      const result1 = generateKeyAuthPlugin();
      const result2 = generateKeyAuthPlugin();

      expect(result1.config.key_names).not.toBe(result2.config.key_names);
      expect(result1.config.key_names).toEqual(result2.config.key_names);
    });

    it('should not share references between calls', () => {
      const result1 = generateKeyAuthPlugin();
      const result2 = generateKeyAuthPlugin();

      // Mutating one should not affect the other
      result1.config.key_names.push('another-header');

      expect(result1.config.key_names).toHaveLength(2);
      expect(result2.config.key_names).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should work when called many times', () => {
      const results = Array.from({ length: 100 }, () =>
        generateKeyAuthPlugin(),
      );

      expect(results).toHaveLength(100);
      results.forEach((result) => {
        expect(result.name).toBe('key-auth');
        expect(result.config.key_names).toEqual(['x-api-key']);
      });
    });

    it('should be serializable to JSON', () => {
      const result = generateKeyAuthPlugin();
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(result);
    });

    it('should have correct structure for YAML serialization', () => {
      const result = generateKeyAuthPlugin();

      // Kong config is written as YAML
      // Verify structure is YAML-friendly (no functions, no undefined, etc.)
      expect(result).toEqual({
        name: 'key-auth',
        config: {
          key_names: ['x-api-key'],
          hide_credentials: false,
        },
      });
    });
  });
});
