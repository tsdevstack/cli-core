import { describe, it, expect } from '@rstest/core';
import { getDefaultKongPlugins } from './default-plugins';

describe('getDefaultKongPlugins', () => {
  describe('with auth template', () => {
    it('should return an array of Kong plugins', () => {
      const plugins = getDefaultKongPlugins(true);

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);
    });

    it('should return 4 default plugins', () => {
      const plugins = getDefaultKongPlugins(true);

      expect(plugins).toHaveLength(4);
    });

    it('should include request-transformer plugin for security headers', () => {
      const plugins = getDefaultKongPlugins(true);
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );

      expect(requestTransformer).toBeDefined();
      expect(requestTransformer?.config).toHaveProperty('remove');
      expect(requestTransformer?.config).toHaveProperty('add');
    });

    it('should remove sensitive headers in request-transformer', () => {
      const plugins = getDefaultKongPlugins(true);
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );

      const removeConfig = requestTransformer?.config.remove as {
        headers: string[];
      };
      expect(removeConfig.headers).toEqual([
        'X-Consumer-Id',
        'X-Consumer-Username',
        'X-JWT-Claim-Sub',
        'X-JWT-Claim-Email',
        'X-JWT-Claim-Role',
        'X-JWT-Claim-Confirmed',
        'X-Kong-Request-Id',
        'X-Kong-Trust',
      ]);
    });

    it('should add trust token header in request-transformer', () => {
      const plugins = getDefaultKongPlugins(true);
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );

      const addConfig = requestTransformer?.config.add as { headers: string[] };
      expect(addConfig.headers).toEqual(['X-Kong-Trust:${KONG_TRUST_TOKEN}']);
    });

    it('should include CORS plugin', () => {
      const plugins = getDefaultKongPlugins(true);
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors).toBeDefined();
      expect(cors?.config).toHaveProperty('origins');
      expect(cors?.config).toHaveProperty('methods');
      expect(cors?.config).toHaveProperty('headers');
      expect(cors?.config).toHaveProperty('credentials');
    });

    it('should configure CORS with placeholder for origins', () => {
      const plugins = getDefaultKongPlugins(true);
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.origins).toEqual(['${KONG_CORS_ORIGINS}']);
    });

    it('should configure CORS with standard HTTP methods', () => {
      const plugins = getDefaultKongPlugins(true);
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.methods).toEqual([
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ]);
    });

    it('should configure CORS with standard headers', () => {
      const plugins = getDefaultKongPlugins(true);
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.headers).toEqual([
        'Accept',
        'Authorization',
        'Content-Type',
        'X-Request-ID',
        'x-api-key',
      ]);
    });

    it('should configure CORS with exposed headers', () => {
      const plugins = getDefaultKongPlugins(true);
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.exposed_headers).toEqual(['X-Request-ID']);
    });

    it('should enable CORS credentials', () => {
      const plugins = getDefaultKongPlugins(true);
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.credentials).toBe(true);
    });

    it('should configure CORS max age', () => {
      const plugins = getDefaultKongPlugins(true);
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.max_age).toBe(3600);
    });

    it('should include rate-limiting plugin', () => {
      const plugins = getDefaultKongPlugins(true);
      const rateLimiting = plugins.find((p) => p.name === 'rate-limiting');

      expect(rateLimiting).toBeDefined();
      expect(rateLimiting?.config).toHaveProperty('minute');
      expect(rateLimiting?.config).toHaveProperty('policy');
    });

    it('should configure rate-limiting with 100 requests per minute', () => {
      const plugins = getDefaultKongPlugins(true);
      const rateLimiting = plugins.find((p) => p.name === 'rate-limiting');

      expect(rateLimiting?.config.minute).toBe(100);
    });

    it('should configure rate-limiting with redis policy', () => {
      const plugins = getDefaultKongPlugins(true);
      const rateLimiting = plugins.find((p) => p.name === 'rate-limiting');

      expect(rateLimiting?.config.policy).toBe('redis');
    });

    it('should include correlation-id plugin', () => {
      const plugins = getDefaultKongPlugins(true);
      const correlationId = plugins.find((p) => p.name === 'correlation-id');

      expect(correlationId).toBeDefined();
      expect(correlationId?.config).toHaveProperty('header_name');
      expect(correlationId?.config).toHaveProperty('generator');
      expect(correlationId?.config).toHaveProperty('echo_downstream');
    });

    it('should configure correlation-id with X-Request-ID header', () => {
      const plugins = getDefaultKongPlugins(true);
      const correlationId = plugins.find((p) => p.name === 'correlation-id');

      expect(correlationId?.config.header_name).toBe('X-Request-ID');
    });

    it('should configure correlation-id with uuid generator', () => {
      const plugins = getDefaultKongPlugins(true);
      const correlationId = plugins.find((p) => p.name === 'correlation-id');

      expect(correlationId?.config.generator).toBe('uuid');
    });

    it('should enable correlation-id echo downstream', () => {
      const plugins = getDefaultKongPlugins(true);
      const correlationId = plugins.find((p) => p.name === 'correlation-id');

      expect(correlationId?.config.echo_downstream).toBe(true);
    });

    it('should return plugins in correct order', () => {
      const plugins = getDefaultKongPlugins(true);

      expect(plugins[0].name).toBe('request-transformer');
      expect(plugins[1].name).toBe('cors');
      expect(plugins[2].name).toBe('rate-limiting');
      expect(plugins[3].name).toBe('correlation-id');
    });

    it('should return a new array on each call (not a reference)', () => {
      const plugins1 = getDefaultKongPlugins(true);
      const plugins2 = getDefaultKongPlugins(true);

      expect(plugins1).not.toBe(plugins2);
      expect(plugins1).toEqual(plugins2);
    });

    it('should return plugins that conform to KongPlugin type', () => {
      const plugins = getDefaultKongPlugins(true);

      plugins.forEach((plugin) => {
        expect(plugin).toHaveProperty('name');
        expect(plugin).toHaveProperty('config');
        expect(typeof plugin.name).toBe('string');
        expect(typeof plugin.config).toBe('object');
      });
    });

    describe('Security headers validation', () => {
      it('should remove all Kong internal headers', () => {
        const plugins = getDefaultKongPlugins(true);
        const requestTransformer = plugins.find(
          (p) => p.name === 'request-transformer',
        );
        const removeConfig = requestTransformer?.config.remove as {
          headers: string[];
        };

        const kongInternalHeaders = removeConfig.headers.filter((h) =>
          h.startsWith('X-Kong-'),
        );
        expect(kongInternalHeaders).toHaveLength(2);
        expect(kongInternalHeaders).toContain('X-Kong-Request-Id');
        expect(kongInternalHeaders).toContain('X-Kong-Trust');
      });

      it('should remove all consumer headers', () => {
        const plugins = getDefaultKongPlugins(true);
        const requestTransformer = plugins.find(
          (p) => p.name === 'request-transformer',
        );
        const removeConfig = requestTransformer?.config.remove as {
          headers: string[];
        };

        const consumerHeaders = removeConfig.headers.filter((h) =>
          h.startsWith('X-Consumer-'),
        );
        expect(consumerHeaders).toHaveLength(2);
        expect(consumerHeaders).toContain('X-Consumer-Id');
        expect(consumerHeaders).toContain('X-Consumer-Username');
      });

      it('should remove all JWT claim headers', () => {
        const plugins = getDefaultKongPlugins(true);
        const requestTransformer = plugins.find(
          (p) => p.name === 'request-transformer',
        );
        const removeConfig = requestTransformer?.config.remove as {
          headers: string[];
        };

        const jwtHeaders = removeConfig.headers.filter((h) =>
          h.startsWith('X-JWT-Claim-'),
        );
        expect(jwtHeaders).toHaveLength(4);
        expect(jwtHeaders).toContain('X-JWT-Claim-Sub');
        expect(jwtHeaders).toContain('X-JWT-Claim-Email');
        expect(jwtHeaders).toContain('X-JWT-Claim-Role');
        expect(jwtHeaders).toContain('X-JWT-Claim-Confirmed');
      });
    });
  });

  describe('without auth template', () => {
    it('should return 4 default plugins', () => {
      const plugins = getDefaultKongPlugins(false);

      expect(plugins).toHaveLength(4);
    });

    it('should not include JWT claim headers in remove list', () => {
      const plugins = getDefaultKongPlugins(false);
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );
      const removeConfig = requestTransformer?.config.remove as {
        headers: string[];
      };

      const jwtHeaders = removeConfig.headers.filter((h) =>
        h.startsWith('X-JWT-Claim-'),
      );
      expect(jwtHeaders).toHaveLength(0);
    });

    it('should still remove consumer headers', () => {
      const plugins = getDefaultKongPlugins(false);
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );
      const removeConfig = requestTransformer?.config.remove as {
        headers: string[];
      };

      expect(removeConfig.headers).toContain('X-Consumer-Id');
      expect(removeConfig.headers).toContain('X-Consumer-Username');
    });

    it('should still remove Kong internal headers', () => {
      const plugins = getDefaultKongPlugins(false);
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );
      const removeConfig = requestTransformer?.config.remove as {
        headers: string[];
      };

      expect(removeConfig.headers).toContain('X-Kong-Request-Id');
      expect(removeConfig.headers).toContain('X-Kong-Trust');
    });

    it('should have exactly 4 headers in remove list (no JWT claims)', () => {
      const plugins = getDefaultKongPlugins(false);
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );
      const removeConfig = requestTransformer?.config.remove as {
        headers: string[];
      };

      expect(removeConfig.headers).toEqual([
        'X-Consumer-Id',
        'X-Consumer-Username',
        'X-Kong-Request-Id',
        'X-Kong-Trust',
      ]);
    });

    it('should still add trust token header', () => {
      const plugins = getDefaultKongPlugins(false);
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );
      const addConfig = requestTransformer?.config.add as { headers: string[] };

      expect(addConfig.headers).toEqual(['X-Kong-Trust:${KONG_TRUST_TOKEN}']);
    });

    it('should include all other plugins unchanged', () => {
      const plugins = getDefaultKongPlugins(false);

      expect(plugins[0].name).toBe('request-transformer');
      expect(plugins[1].name).toBe('cors');
      expect(plugins[2].name).toBe('rate-limiting');
      expect(plugins[3].name).toBe('correlation-id');
    });
  });
});
