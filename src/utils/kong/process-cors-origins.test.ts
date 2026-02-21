import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { processCorsOrigins } from './process-cors-origins';
import type { KongTemplate } from './types';

// Mock logger
rs.mock('../logger', () => ({
  logger: {
    info: rs.fn(),
    warn: rs.fn(),
  },
}));

describe('processCorsOrigins', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('No CORS plugin', () => {
    it('should do nothing if config has no plugins', () => {
      const config: KongTemplate = {
        services: [],
      };

      processCorsOrigins(config);

      expect(config.plugins).toBeUndefined();
    });

    it('should do nothing if plugins array is empty', () => {
      const config: KongTemplate = {
        services: [],
        plugins: [],
      };

      processCorsOrigins(config);

      expect(config.plugins).toEqual([]);
    });

    it('should do nothing if no CORS plugin exists', () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'rate-limiting',
            config: { minute: 100 },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins).toHaveLength(1);
      expect(config.plugins?.[0].name).toBe('rate-limiting');
    });
  });

  describe('CORS plugin with non-string origins', () => {
    it('should do nothing if origins is already an array', () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: ['http://localhost:3000', 'http://localhost:3001'],
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ]);
    });

    it('should do nothing if origins is not a string (edge case)', () => {
      // Test edge case where origins somehow gets set to non-string value
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: ['http://localhost:3000'], // Already an array
            },
          },
        ],
      };

      processCorsOrigins(config);

      // Should remain unchanged
      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
      ]);
    });
  });

  describe('Unresolved placeholder', () => {
    it('should convert unresolved placeholder to empty array', async () => {
      const { logger } = await import('../logger');
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: '${KONG_CORS_ORIGINS}',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        '   CORS origins not configured',
      );
    });

    it('should convert empty string to empty array', async () => {
      const { logger } = await import('../logger');
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: '',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith(
        '   CORS origins not configured',
      );
    });
  });

  describe('Single origin', () => {
    it('should convert single origin string to array', async () => {
      const { logger } = await import('../logger');
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: 'http://localhost:3000',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
      ]);
      expect(logger.info).toHaveBeenCalledWith(
        '   📡 CORS origins: http://localhost:3000',
      );
    });

    it('should trim whitespace from single origin', async () => {
      const { logger } = await import('../logger');
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: '  http://localhost:3000  ',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
      ]);
      expect(logger.info).toHaveBeenCalledWith(
        '   📡 CORS origins: http://localhost:3000',
      );
    });
  });

  describe('Multiple origins', () => {
    it('should convert comma-separated origins to array', async () => {
      const { logger } = await import('../logger');
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: 'http://localhost:3000,http://localhost:3001',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ]);
      expect(logger.info).toHaveBeenCalledWith(
        '   📡 CORS origins: http://localhost:3000, http://localhost:3001',
      );
    });

    it('should trim whitespace from all origins', async () => {
      const { logger } = await import('../logger');
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: '  http://localhost:3000  ,  http://localhost:3001  ',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ]);
      expect(logger.info).toHaveBeenCalledWith(
        '   📡 CORS origins: http://localhost:3000, http://localhost:3001',
      );
    });

    it('should handle origins with spaces after commas', async () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins:
                'http://localhost:3000, http://localhost:3001, http://localhost:3002',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
      ]);
    });

    it('should handle many origins', async () => {
      const { logger } = await import('../logger');
      const origins = Array.from(
        { length: 10 },
        (_, i) => `http://localhost:${3000 + i}`,
      );
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: origins.join(','),
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual(origins);
      expect(logger.info).toHaveBeenCalledWith(
        `   📡 CORS origins: ${origins.join(', ')}`,
      );
    });
  });

  describe('Multiple plugins', () => {
    it('should only process CORS plugin when multiple plugins exist', async () => {
      const { logger } = await import('../logger');
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'rate-limiting',
            config: { minute: 100 },
          },
          {
            name: 'cors',
            config: {
              origins: 'http://localhost:3000,http://localhost:3001',
            },
          },
          {
            name: 'correlation-id',
            config: { header_name: 'X-Request-ID' },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].name).toBe('rate-limiting');
      expect(config.plugins?.[0].config).toEqual({ minute: 100 });
      expect(config.plugins?.[1].name).toBe('cors');
      expect(config.plugins?.[1].config.origins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ]);
      expect(config.plugins?.[2].name).toBe('correlation-id');
      expect(config.plugins?.[2].config).toEqual({
        header_name: 'X-Request-ID',
      });
      expect(logger.info).toHaveBeenCalledWith(
        '   📡 CORS origins: http://localhost:3000, http://localhost:3001',
      );
    });

    it('should process first CORS plugin if multiple CORS plugins exist', async () => {
      const { logger } = await import('../logger');
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: 'http://localhost:3000',
            },
          },
          {
            name: 'cors',
            config: {
              origins: 'http://localhost:3001',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
      ]);
      expect(config.plugins?.[1].config.origins).toBe('http://localhost:3001');
      expect(logger.info).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        '   📡 CORS origins: http://localhost:3000',
      );
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle production URLs', async () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins:
                'https://example.com,https://www.example.com,https://api.example.com',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'https://example.com',
        'https://www.example.com',
        'https://api.example.com',
      ]);
    });

    it('should handle mixed localhost and production URLs', async () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins:
                'http://localhost:3000,http://localhost:3001,https://staging.example.com,https://example.com',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
        'https://staging.example.com',
        'https://example.com',
      ]);
    });

    it('should handle URLs with ports', async () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: 'http://localhost:3000,http://staging.example.com:8080',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
        'http://staging.example.com:8080',
      ]);
    });

    it('should handle wildcard origins', async () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: '*',
            },
          },
        ],
      };

      processCorsOrigins(config);

      expect(config.plugins?.[0].config.origins).toEqual(['*']);
    });
  });

  describe('Mutation', () => {
    it('should mutate the original config object', () => {
      const config: KongTemplate = {
        services: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: 'http://localhost:3000,http://localhost:3001',
            },
          },
        ],
      };

      const originalPlugin = config.plugins?.[0];

      processCorsOrigins(config);

      // Should mutate the same object reference
      expect(config.plugins?.[0]).toBe(originalPlugin);
      expect(config.plugins?.[0].config.origins).toEqual([
        'http://localhost:3000',
        'http://localhost:3001',
      ]);
    });
  });
});
