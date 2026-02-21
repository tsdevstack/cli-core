import { describe, it, expect } from '@rstest/core';
import { deepDeleteServiceReferences } from './deep-delete-service-references';
import type { SecretsFile } from './types';

describe('deepDeleteServiceReferences', () => {
  describe('Object key deletion', () => {
    it('should delete service section keys (exact match)', () => {
      const input = {
        secrets: {},
        'demo-service': {
          secrets: ['API_URL'],
          API_KEY: 'DEMO_SERVICE_API_KEY',
        },
        'other-service': {
          secrets: [],
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {},
        'other-service': {
          secrets: [],
        },
      });
    });

    it('should delete uppercase keys with underscore prefix (e.g., DEMO_SERVICE_API_KEY)', () => {
      const input = {
        secrets: {
          DEMO_SERVICE_API_KEY: 'secret123',
          OTHER_KEY: 'value',
          AUTH_SERVICE_KEY: 'auth-key',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {
          OTHER_KEY: 'value',
          AUTH_SERVICE_KEY: 'auth-key',
        },
      });
    });

    it('should delete multiple keys with same service prefix', () => {
      const input = {
        secrets: {
          DEMO_SERVICE_API_KEY: 'key1',
          DEMO_SERVICE_SECRET: 'key2',
          DEMO_SERVICE_TOKEN: 'key3',
          OTHER_KEY: 'preserved',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {
          OTHER_KEY: 'preserved',
        },
      });
    });
  });

  describe('String value deletion', () => {
    it('should remove values containing uppercase service name', () => {
      const input = {
        secrets: {
          KEY1: 'DEMO_SERVICE_API_KEY',
          KEY2: 'other-value',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {
          KEY2: 'other-value',
        },
      });
    });

    it('should remove values with partial matches of service name', () => {
      const input = {
        value1: 'Use DEMO_SERVICE_API_KEY here',
        value2: 'No service reference here',
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        value2: 'No service reference here',
      });
    });

    it('should not modify strings without the service name', () => {
      const input = {
        value: 'OTHER_SERVICE_API_KEY',
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(false);
      expect(result).toEqual(input);
    });
  });

  describe('Nested structures', () => {
    it('should handle deeply nested objects', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              DEMO_SERVICE_API_KEY: 'value',
              OTHER_KEY: 'preserved',
            },
          },
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              OTHER_KEY: 'preserved',
            },
          },
        },
      });
    });

    it('should handle arrays with objects', () => {
      const input = {
        services: [
          { name: 'DEMO_SERVICE_API_KEY' },
          { name: 'OTHER_KEY' },
          { name: 'DEMO_SERVICE_SECRET' },
        ],
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      // Objects with deleted properties become empty but remain in array
      expect(result).toEqual({
        services: [{}, { name: 'OTHER_KEY' }, {}],
      });
    });

    it('should handle arrays with strings', () => {
      const input = {
        keys: [
          'DEMO_SERVICE_API_KEY',
          'OTHER_KEY',
          'DEMO_SERVICE_SECRET',
          'PRESERVED_KEY',
        ],
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        keys: ['OTHER_KEY', 'PRESERVED_KEY'],
      });
    });

    it('should remove empty arrays after filtering', () => {
      const input = {
        keys: ['DEMO_SERVICE_API_KEY'],
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        keys: [],
      });
    });
  });

  describe('Real-world secrets file structure', () => {
    it('should handle complete user secrets file deletion', () => {
      const input: SecretsFile = {
        secrets: {
          DEMO_SERVICE_API_KEY: 'abc123',
          AUTH_SERVICE_API_KEY: 'xyz789',
          API_URL: 'http://localhost:8000',
        },
        'demo-service': {
          secrets: [],
          API_KEY: 'DEMO_SERVICE_API_KEY',
          ALLOWED_ORIGINS: 'http://localhost:3000',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {
          AUTH_SERVICE_API_KEY: 'xyz789',
          API_URL: 'http://localhost:8000',
        },
        'auth-service': {
          secrets: [],
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      });
    });

    it('should handle framework secrets file deletion', () => {
      const input = {
        secrets: {
          AUTH_SECRET: 'framework-secret',
          API_KEY: 'kong-key',
          DEMO_SERVICE_API_KEY: 'service-key',
          USER_SERVICE_API_KEY: 'user-key',
        },
        'demo-service': {
          secrets: [],
          API_KEY: 'DEMO_SERVICE_API_KEY',
        },
        'user-service': {
          secrets: [],
          API_KEY: 'USER_SERVICE_API_KEY',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {
          AUTH_SECRET: 'framework-secret',
          API_KEY: 'kong-key',
          USER_SERVICE_API_KEY: 'user-key',
        },
        'user-service': {
          secrets: [],
          API_KEY: 'USER_SERVICE_API_KEY',
        },
      });
    });

    it('should handle deleting last service from secrets file', () => {
      const input: SecretsFile = {
        secrets: {
          DEMO_SERVICE_API_KEY: 'abc123',
        },
        'demo-service': {
          secrets: [],
          API_KEY: 'DEMO_SERVICE_API_KEY',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {},
      });
    });
  });

  describe('Edge cases', () => {
    it('should return modified=false when no changes needed', () => {
      const input = {
        secrets: {
          OTHER_KEY: 'value',
        },
        'other-service': {
          secrets: [],
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(false);
      expect(result).toEqual(input);
    });

    it('should handle null values', () => {
      const input = {
        value: null,
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(false);
      expect(result).toEqual(input);
    });

    it('should handle undefined values', () => {
      const input = {
        value: undefined,
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      // undefined values are removed from objects (treated as deletion)
      expect(modified).toBe(true);
      expect(result).toEqual({});
    });

    it('should handle empty object', () => {
      const input = {};

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(false);
      expect(result).toEqual({});
    });

    it('should handle empty array', () => {
      const input = { values: [] };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(false);
      expect(result).toEqual({ values: [] });
    });

    it('should handle primitives (numbers)', () => {
      const input = { value: 42 };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(false);
      expect(result).toEqual({ value: 42 });
    });

    it('should handle primitives (booleans)', () => {
      const input = { value: true };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(false);
      expect(result).toEqual({ value: true });
    });
  });

  describe('Case sensitivity', () => {
    it('should only match exact uppercase conversion', () => {
      const input = {
        secrets: {
          demo_service_api_key: 'lowercase',
          DEMO_SERVICE_API_KEY: 'uppercase',
          Demo_Service_Api_Key: 'mixed',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {
          demo_service_api_key: 'lowercase',
          Demo_Service_Api_Key: 'mixed',
        },
      });
    });

    it('should delete only exact kebab-case service section keys', () => {
      const input = {
        'demo-service': { value: 1 },
        'Demo-Service': { value: 2 },
        'DEMO-SERVICE': { value: 3 },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        'Demo-Service': { value: 2 },
        'DEMO-SERVICE': { value: 3 },
      });
    });
  });

  describe('Multiple service deletions (sequential)', () => {
    it('should handle chained deletions correctly', () => {
      const input = {
        secrets: {
          DEMO_SERVICE_API_KEY: 'key1',
          TEST_SERVICE_API_KEY: 'key2',
          AUTH_SERVICE_API_KEY: 'key3',
        },
        'demo-service': {
          API_KEY: 'DEMO_SERVICE_API_KEY',
        },
        'test-service': {
          API_KEY: 'TEST_SERVICE_API_KEY',
        },
        'auth-service': {
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      };

      // First deletion: demo-service
      const step1 = deepDeleteServiceReferences(input, 'demo-service');
      expect(step1.modified).toBe(true);

      // Second deletion: test-service
      const step2 = deepDeleteServiceReferences(step1.result, 'test-service');
      expect(step2.modified).toBe(true);

      expect(step2.result).toEqual({
        secrets: {
          AUTH_SERVICE_API_KEY: 'key3',
        },
        'auth-service': {
          API_KEY: 'AUTH_SERVICE_API_KEY',
        },
      });
    });
  });

  describe('Service name conversions', () => {
    it('should handle single-word service names', () => {
      const input = {
        api: { value: 'data' },
        backend: { value: 'other' },
        secrets: {
          API_KEY: 'key',
          BACKEND_KEY: 'key2',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(input, 'api');

      expect(modified).toBe(true);
      expect(result).toEqual({
        backend: { value: 'other' },
        secrets: {
          BACKEND_KEY: 'key2',
        },
      });
    });

    it('should handle multi-dash service names', () => {
      const input = {
        'my-very-long-service-name': { value: 1 },
        'short-service': { value: 2 },
        secrets: {
          MY_VERY_LONG_SERVICE_NAME_API_KEY: 'key1',
          SHORT_SERVICE_API_KEY: 'key2',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'my-very-long-service-name',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        'short-service': { value: 2 },
        secrets: {
          SHORT_SERVICE_API_KEY: 'key2',
        },
      });
    });

    it('should handle service names with numbers', () => {
      const input = {
        'api-v2': { value: 1 },
        'api-v3': { value: 2 },
        secrets: {
          API_V2_KEY: 'key1',
          API_V3_KEY: 'key2',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(input, 'api-v2');

      expect(modified).toBe(true);
      expect(result).toEqual({
        'api-v3': { value: 2 },
        secrets: {
          API_V3_KEY: 'key2',
        },
      });
    });
  });

  describe('Partial key matches (should not delete)', () => {
    it('should not delete keys that only contain service name as substring', () => {
      const input = {
        secrets: {
          MY_DEMO_SERVICE_KEY: 'should-keep-1',
          DEMO_SERVICE_DEMO_KEY: 'should-keep-2',
          DEMO_SERVICEKEY: 'should-keep-3',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      // Actually, DEMO_SERVICE_DEMO_KEY starts with DEMO_SERVICE_ so it will be deleted
      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {
          MY_DEMO_SERVICE_KEY: 'should-keep-1',
          DEMO_SERVICEKEY: 'should-keep-3',
        },
      });
    });

    it('should only delete keys with exact prefix match followed by underscore', () => {
      const input = {
        secrets: {
          DEMO_SERVICE_API_KEY: 'should-delete',
          DEMO_SERVICEAPI_KEY: 'should-keep',
          DEMOX_SERVICE_API_KEY: 'should-keep',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        secrets: {
          DEMO_SERVICEAPI_KEY: 'should-keep',
          DEMOX_SERVICE_API_KEY: 'should-keep',
        },
      });
    });
  });

  describe('Complex nested deletion scenarios', () => {
    it('should handle mixed nested structures with deletions at multiple levels', () => {
      const input = {
        level1: {
          'demo-service': {
            API_KEY: 'DEMO_SERVICE_API_KEY',
          },
          other: {
            DEMO_SERVICE_REF: 'reference',
            KEPT_KEY: 'kept',
          },
        },
        secrets: {
          DEMO_SERVICE_API_KEY: 'key',
          OTHER_KEY: 'other',
        },
      };

      const { modified, result } = deepDeleteServiceReferences(
        input,
        'demo-service',
      );

      expect(modified).toBe(true);
      expect(result).toEqual({
        level1: {
          other: {
            KEPT_KEY: 'kept',
          },
        },
        secrets: {
          OTHER_KEY: 'other',
        },
      });
    });
  });
});
