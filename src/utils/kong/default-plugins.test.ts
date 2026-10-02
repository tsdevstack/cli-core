import { describe, it, expect } from '@rstest/core';
import { getDefaultKongPlugins } from './default-plugins';

describe('getDefaultKongPlugins', () => {
  describe('plugins', () => {
    it('should return an array of Kong plugins', () => {
      const plugins = getDefaultKongPlugins();

      expect(Array.isArray(plugins)).toBe(true);
      expect(plugins.length).toBeGreaterThan(0);
    });

    it('should return 4 default plugins', () => {
      const plugins = getDefaultKongPlugins();

      expect(plugins).toHaveLength(4);
    });

    it('should include request-transformer plugin for security headers', () => {
      const plugins = getDefaultKongPlugins();
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );

      expect(requestTransformer).toBeDefined();
      expect(requestTransformer?.config).toHaveProperty('remove');
      expect(requestTransformer?.config).toHaveProperty('add');
    });

    it('should only remove X-Kong-Request-Id and X-Kong-Trust in request-transformer', () => {
      const plugins = getDefaultKongPlugins();
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );

      const removeConfig = requestTransformer?.config.remove as {
        headers: string[];
      };
      expect(removeConfig.headers).toEqual([
        'X-Kong-Request-Id',
        'X-Kong-Trust',
      ]);
    });

    it('should add trust token header in request-transformer', () => {
      const plugins = getDefaultKongPlugins();
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );

      const addConfig = requestTransformer?.config.add as { headers: string[] };
      expect(addConfig.headers).toEqual(['X-Kong-Trust:${KONG_TRUST_TOKEN}']);
    });

    it('should include CORS plugin', () => {
      const plugins = getDefaultKongPlugins();
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors).toBeDefined();
      expect(cors?.config).toHaveProperty('origins');
      expect(cors?.config).toHaveProperty('methods');
      expect(cors?.config).toHaveProperty('headers');
      expect(cors?.config).toHaveProperty('credentials');
    });

    it('should configure CORS with placeholder for origins', () => {
      const plugins = getDefaultKongPlugins();
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.origins).toEqual(['${KONG_CORS_ORIGINS}']);
    });

    it('should configure CORS with standard HTTP methods', () => {
      const plugins = getDefaultKongPlugins();
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
      const plugins = getDefaultKongPlugins();
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
      const plugins = getDefaultKongPlugins();
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.exposed_headers).toEqual(['X-Request-ID']);
    });

    it('should enable CORS credentials', () => {
      const plugins = getDefaultKongPlugins();
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.credentials).toBe(true);
    });

    it('should configure CORS max age', () => {
      const plugins = getDefaultKongPlugins();
      const cors = plugins.find((p) => p.name === 'cors');

      expect(cors?.config.max_age).toBe(3600);
    });

    it('should include rate-limiting plugin', () => {
      const plugins = getDefaultKongPlugins();
      const rateLimiting = plugins.find((p) => p.name === 'rate-limiting');

      expect(rateLimiting).toBeDefined();
      expect(rateLimiting?.config).toHaveProperty('minute');
      expect(rateLimiting?.config).toHaveProperty('policy');
    });

    it('should configure rate-limiting with 100 requests per minute', () => {
      const plugins = getDefaultKongPlugins();
      const rateLimiting = plugins.find((p) => p.name === 'rate-limiting');

      expect(rateLimiting?.config.minute).toBe(100);
    });

    it('should configure rate-limiting with redis policy', () => {
      const plugins = getDefaultKongPlugins();
      const rateLimiting = plugins.find((p) => p.name === 'rate-limiting');

      expect(rateLimiting?.config.policy).toBe('redis');
    });

    it('should include correlation-id plugin', () => {
      const plugins = getDefaultKongPlugins();
      const correlationId = plugins.find((p) => p.name === 'correlation-id');

      expect(correlationId).toBeDefined();
      expect(correlationId?.config).toHaveProperty('header_name');
      expect(correlationId?.config).toHaveProperty('generator');
      expect(correlationId?.config).toHaveProperty('echo_downstream');
    });

    it('should configure correlation-id with X-Request-ID header', () => {
      const plugins = getDefaultKongPlugins();
      const correlationId = plugins.find((p) => p.name === 'correlation-id');

      expect(correlationId?.config.header_name).toBe('X-Request-ID');
    });

    it('should configure correlation-id with uuid generator', () => {
      const plugins = getDefaultKongPlugins();
      const correlationId = plugins.find((p) => p.name === 'correlation-id');

      expect(correlationId?.config.generator).toBe('uuid');
    });

    it('should enable correlation-id echo downstream', () => {
      const plugins = getDefaultKongPlugins();
      const correlationId = plugins.find((p) => p.name === 'correlation-id');

      expect(correlationId?.config.echo_downstream).toBe(true);
    });

    it('should return plugins in correct order', () => {
      const plugins = getDefaultKongPlugins();

      expect(plugins[0].name).toBe('request-transformer');
      expect(plugins[1].name).toBe('cors');
      expect(plugins[2].name).toBe('rate-limiting');
      expect(plugins[3].name).toBe('correlation-id');
    });

    it('should return a new array on each call (not a reference)', () => {
      const plugins1 = getDefaultKongPlugins();
      const plugins2 = getDefaultKongPlugins();

      expect(plugins1).not.toBe(plugins2);
      expect(plugins1).toEqual(plugins2);
    });

    it('should return plugins that conform to KongPlugin type', () => {
      const plugins = getDefaultKongPlugins();

      plugins.forEach((plugin) => {
        expect(plugin).toHaveProperty('name');
        expect(plugin).toHaveProperty('config');
        expect(typeof plugin.name).toBe('string');
        expect(typeof plugin.config).toBe('object');
      });
    });

    describe('Security headers validation', () => {
      it('should remove all Kong internal headers', () => {
        const plugins = getDefaultKongPlugins();
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
    });
  });

  describe('identity headers', () => {
    it('should not remove any identity header (the auth plugins set them before request-transformer runs)', () => {
      const plugins = getDefaultKongPlugins();
      const requestTransformer = plugins.find(
        (p) => p.name === 'request-transformer',
      );
      const removeConfig = requestTransformer?.config.remove as {
        headers: string[];
      };

      for (const header of [
        'X-Consumer-Id',
        'X-Consumer-Username',
        'X-Credential-Identifier',
        'X-Userinfo',
        'X-Api-Key-Id',
        'X-Api-Key-Consumer',
      ]) {
        expect(removeConfig.headers).not.toContain(header);
      }
    });

    it('should not include tsdevstack-strip-identity (framework plugin, generated into kong.tsdevstack.yml)', () => {
      expect(getDefaultKongPlugins().map((p) => p.name)).not.toContain(
        'tsdevstack-strip-identity',
      );
    });
  });
});
