import { describe, it, expect } from '@rstest/core';
import { createServiceSection } from './create-service-section';
import type { FrameworkService } from '../config';

describe('createServiceSection', () => {
  describe('Backend services (NestJS)', () => {
    it('should create section with empty secrets array only', () => {
      const service: FrameworkService = {
        name: 'auth-service',
        type: 'nestjs',
        port: 3001,
      } as FrameworkService;

      const result = createServiceSection(service);

      expect(result).toEqual({
        secrets: [], // Backend secrets (KONG_TRUST_TOKEN, API keys) moved to framework file
      });
      expect(result).not.toHaveProperty('ALLOWED_ORIGINS'); // Removed - apps not called directly
      expect(result).not.toHaveProperty('API_KEY'); // Moved to framework file
    });

    it('should not include ALLOWED_ORIGINS (removed - apps not called directly)', () => {
      const service: FrameworkService = {
        name: 'user-service',
        type: 'nestjs',
        port: 3002,
      } as FrameworkService;

      const result = createServiceSection(service);

      expect(result).toEqual({
        secrets: [], // Backend secrets moved to framework file
      });
      expect(result).not.toHaveProperty('ALLOWED_ORIGINS');
    });

    it('should not include API_KEY reference (moved to framework file)', () => {
      const service: FrameworkService = {
        name: 'my-complex-service-name',
        type: 'nestjs',
        port: 3003,
      } as FrameworkService;

      const result = createServiceSection(service);

      // API_KEY references are now in framework file
      expect(result.API_KEY).toBeUndefined();
      expect(result).not.toHaveProperty('API_KEY');
    });
  });

  describe('Frontend services', () => {
    it('should create section with API_URL and TTL values in secrets array for Next.js', () => {
      const service: FrameworkService = {
        name: 'frontend',
        type: 'nextjs',
        port: 3000,
      } as FrameworkService;

      const result = createServiceSection(service);

      expect(result).toEqual({
        secrets: ['API_URL', 'ACCESS_TOKEN_TTL', 'REFRESH_TOKEN_TTL'], // Next.js gets API_URL + TTL values
      });
      expect(result).not.toHaveProperty('API_KEY');
      expect(result).not.toHaveProperty('ALLOWED_ORIGINS');
    });

    it('should create section with API_URL in secrets array for SPA', () => {
      const service: FrameworkService = {
        name: 'admin-ui',
        type: 'spa',
        port: 3001,
      } as FrameworkService;

      const result = createServiceSection(service);

      expect(result).toEqual({
        secrets: ['API_URL'],
      });
    });
  });

  describe('Different service types', () => {
    it('should handle backend service without frontends', () => {
      const service: FrameworkService = {
        name: 'api',
        type: 'nestjs',
        port: 4000,
      } as FrameworkService;

      const result = createServiceSection(service);

      expect(result).toEqual({
        secrets: [],
      });
      expect(result).not.toHaveProperty('ALLOWED_ORIGINS');
    });

    it('should differentiate backend vs frontend structure', () => {
      const backendService: FrameworkService = {
        name: 'backend',
        type: 'nestjs',
        port: 5000,
      } as FrameworkService;

      const frontendService: FrameworkService = {
        name: 'frontend',
        type: 'spa',
        port: 3000,
      } as FrameworkService;

      const backendResult = createServiceSection(backendService);
      const frontendResult = createServiceSection(frontendService);

      // Backend: empty secrets array, no ALLOWED_ORIGINS
      expect(backendResult.secrets).toEqual([]);
      expect(backendResult).not.toHaveProperty('ALLOWED_ORIGINS');

      // Frontend: API_URL in secrets array
      expect(frontendResult.secrets).toEqual(['API_URL']);
    });
  });
});
