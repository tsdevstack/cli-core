import { describe, it, expect } from '@rstest/core';
import { mergeKongConfigs } from './merge-kong-configs';
import type { KongTemplate } from './types';

describe('mergeKongConfigs', () => {
  describe('Basic merging', () => {
    it('should merge framework and user configs with correct structure', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'auth-service',
            url: 'http://auth:3001',
            routes: [
              {
                name: 'auth-routes',
                paths: ['/auth'],
                strip_path: false,
              },
            ],
          },
        ],
        consumers: [
          {
            username: 'partner-a',
          },
        ],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: ['http://localhost:3000'],
            },
          },
        ],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result.services).toHaveLength(1);
      expect(result.consumers).toHaveLength(1);
      expect(result.plugins).toHaveLength(1);
    });

    it('should have correct format version and transform flag', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result._format_version).toBe('3.0');
      expect(result._transform).toBe(true);
    });
  });

  describe('Services merging', () => {
    it('should include all framework services', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'auth-service',
            url: 'http://auth:3001',
            routes: [
              { name: 'auth-routes', paths: ['/auth'], strip_path: false },
            ],
          },
          {
            name: 'user-service',
            url: 'http://users:3002',
            routes: [
              { name: 'user-routes', paths: ['/users'], strip_path: false },
            ],
          },
        ],
        consumers: [],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result.services).toHaveLength(2);
      expect(result.services[0].name).toBe('auth-service');
      expect(result.services[1].name).toBe('user-service');
    });

    it('should append user custom services after framework services', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'auth-service',
            url: 'http://auth:3001',
            routes: [
              { name: 'auth-routes', paths: ['/auth'], strip_path: false },
            ],
          },
        ],
        consumers: [],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'external-api',
            url: 'https://api.example.com',
            routes: [
              {
                name: 'external-routes',
                paths: ['/external'],
                strip_path: true,
              },
            ],
          },
        ],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result.services).toHaveLength(2);
      expect(result.services[0].name).toBe('auth-service');
      expect(result.services[1].name).toBe('external-api');
    });

    it('should handle empty framework services', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'custom-service',
            url: 'http://custom:8080',
            routes: [
              { name: 'custom-routes', paths: ['/custom'], strip_path: false },
            ],
          },
        ],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('custom-service');
    });

    it('should handle empty user services', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'auth-service',
            url: 'http://auth:3001',
            routes: [
              { name: 'auth-routes', paths: ['/auth'], strip_path: false },
            ],
          },
        ],
        consumers: [],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('auth-service');
    });
  });

  describe('Consumers merging', () => {
    it('should merge framework and user consumers', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [{ username: 'partner-a' }, { username: 'partner-b' }],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [{ username: 'manual-consumer' }],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      // Consumers from both framework (auto-generated) and user (manual)
      expect(result.consumers).toHaveLength(3);
      expect(result.consumers![0].username).toBe('partner-a');
      expect(result.consumers![1].username).toBe('partner-b');
      expect(result.consumers![2].username).toBe('manual-consumer');
    });

    it('should handle empty framework consumers with user consumers', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [{ username: 'manual-consumer' }],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result.consumers).toHaveLength(1);
      expect(result.consumers![0].username).toBe('manual-consumer');
    });

    it('should handle empty user consumers with framework consumers', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [{ username: 'partner-a' }],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result.consumers).toHaveLength(1);
      expect(result.consumers![0].username).toBe('partner-a');
    });
  });

  describe('Plugins merging', () => {
    it('should use user plugins only (framework plugins are ignored)', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [{ name: 'should-be-ignored', config: {} }],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [
          { name: 'cors', config: { origins: ['*'] } },
          { name: 'rate-limiting', config: { minute: 100 } },
        ],
      };

      const result = mergeKongConfigs(framework, user);

      // Plugins come ONLY from user (operational plugins)
      expect(result.plugins).toHaveLength(2);
      expect(result.plugins![0].name).toBe('cors');
      expect(result.plugins![1].name).toBe('rate-limiting');
    });

    it('should handle empty user plugins', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [{ name: 'ignored', config: {} }],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result.plugins).toHaveLength(0);
    });
  });

  describe('Real-world scenario', () => {
    it('should merge typical framework and user configs correctly', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'auth-service',
            url: 'http://auth:3001',
            routes: [
              {
                name: 'auth-routes',
                paths: ['/auth'],
                strip_path: false,
              },
            ],
            plugins: [
              {
                name: 'oidc',
                config: {
                  client_id: 'kong',
                  client_secret: 'kong-secret',
                  discovery:
                    'http://auth:3001/auth/.well-known/openid-configuration',
                },
              },
            ],
          },
          {
            name: 'users-service',
            url: 'http://users:3002',
            routes: [
              {
                name: 'users-routes',
                paths: ['/users'],
                strip_path: false,
              },
            ],
          },
        ],
        consumers: [
          {
            username: 'spotify',
            keyauth_credentials: [
              {
                key: '${SPOTIFY_PARTNER_API_KEY}',
              },
            ],
          },
        ],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'external-spotify-api',
            url: 'https://api.spotify.com',
            routes: [
              {
                name: 'spotify-proxy',
                paths: ['/spotify'],
                strip_path: true,
              },
            ],
          },
        ],
        consumers: [],
        plugins: [
          {
            name: 'cors',
            config: {
              origins: ['http://localhost:3000'],
              credentials: true,
            },
          },
          {
            name: 'rate-limiting',
            config: {
              minute: 100,
            },
          },
        ],
      };

      const result = mergeKongConfigs(framework, user);

      // Services: framework (2) + user (1) = 3
      expect(result.services).toHaveLength(3);
      expect(result.services[0].name).toBe('auth-service');
      expect(result.services[1].name).toBe('users-service');
      expect(result.services[2].name).toBe('external-spotify-api');

      // Consumers: framework only
      expect(result.consumers).toHaveLength(1);
      expect(result.consumers![0].username).toBe('spotify');

      // Plugins: user only
      expect(result.plugins).toHaveLength(2);
      expect(result.plugins![0].name).toBe('cors');
      expect(result.plugins![1].name).toBe('rate-limiting');
    });
  });

  describe('Return value structure', () => {
    it('should always return KongTemplate with all required properties', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result).toHaveProperty('_format_version');
      expect(result).toHaveProperty('_transform');
      expect(result).toHaveProperty('services');
      expect(result).toHaveProperty('consumers');
      expect(result).toHaveProperty('plugins');
    });

    it('should return arrays for all collection properties', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(Array.isArray(result.services)).toBe(true);
      expect(Array.isArray(result.consumers)).toBe(true);
      expect(Array.isArray(result.plugins)).toBe(true);
    });
  });

  describe('Immutability', () => {
    it('should not mutate framework config', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'auth',
            url: 'http://auth:3001',
            routes: [
              { name: 'auth-routes', paths: ['/auth'], strip_path: false },
            ],
          },
        ],
        consumers: [{ username: 'partner-a' }],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'custom',
            url: 'http://custom:8080',
            routes: [
              { name: 'custom-routes', paths: ['/custom'], strip_path: false },
            ],
          },
        ],
        consumers: [],
        plugins: [{ name: 'cors', config: {} }],
      };

      const originalFrameworkServicesLength = framework.services.length;
      const originalFrameworkConsumersLength = framework.consumers!.length;

      mergeKongConfigs(framework, user);

      expect(framework.services.length).toBe(originalFrameworkServicesLength);
      expect(framework.consumers!.length).toBe(
        originalFrameworkConsumersLength,
      );
    });

    it('should not mutate user config', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'auth',
            url: 'http://auth:3001',
            routes: [
              { name: 'auth-routes', paths: ['/auth'], strip_path: false },
            ],
          },
        ],
        consumers: [{ username: 'partner-a' }],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'custom',
            url: 'http://custom:8080',
            routes: [
              { name: 'custom-routes', paths: ['/custom'], strip_path: false },
            ],
          },
        ],
        consumers: [],
        plugins: [{ name: 'cors', config: {} }],
      };

      const originalUserServicesLength = user.services.length;
      const originalUserPluginsLength = user.plugins!.length;

      mergeKongConfigs(framework, user);

      expect(user.services.length).toBe(originalUserServicesLength);
      expect(user.plugins!.length).toBe(originalUserPluginsLength);
    });
  });

  describe('Edge cases', () => {
    it('should preserve service order (framework first, then user)', () => {
      const framework: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'framework-1',
            url: 'http://f1:3001',
            routes: [{ name: 'f1-routes', paths: ['/f1'], strip_path: false }],
          },
          {
            name: 'framework-2',
            url: 'http://f2:3002',
            routes: [{ name: 'f2-routes', paths: ['/f2'], strip_path: false }],
          },
        ],
        consumers: [],
        plugins: [],
      };

      const user: KongTemplate = {
        _format_version: '3.0',
        _transform: true,
        services: [
          {
            name: 'user-1',
            url: 'http://u1:8001',
            routes: [{ name: 'u1-routes', paths: ['/u1'], strip_path: true }],
          },
          {
            name: 'user-2',
            url: 'http://u2:8002',
            routes: [{ name: 'u2-routes', paths: ['/u2'], strip_path: true }],
          },
        ],
        consumers: [],
        plugins: [],
      };

      const result = mergeKongConfigs(framework, user);

      expect(result.services[0].name).toBe('framework-1');
      expect(result.services[1].name).toBe('framework-2');
      expect(result.services[2].name).toBe('user-1');
      expect(result.services[3].name).toBe('user-2');
    });
  });
});
