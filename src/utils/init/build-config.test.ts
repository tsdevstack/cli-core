import { describe, it, expect } from '@rstest/core';
import { buildConfig } from './build-config';
import type { InitOptions } from './prompt-init-options';

describe('buildConfig', () => {
  describe('Standard use cases', () => {
    it('should set project name and version', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
      };

      const config = buildConfig(options);

      expect(config.project.name).toBe('my-app');
      expect(config.project.version).toBe('0.1.0');
    });

    it('should set template to null for empty template', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
      };

      const config = buildConfig(options);

      expect(config.framework?.template).toBeNull();
    });

    it('should set template to auth for auth template', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'auth',
        frontendName: null,
      };

      const config = buildConfig(options);

      expect(config.framework?.template).toBe('auth');
    });

    it('should set template to fullstack-auth for fullstack-auth template', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'fullstack-auth',
        frontendName: 'frontend',
      };

      const config = buildConfig(options);

      expect(config.framework?.template).toBe('fullstack-auth');
    });

    it('should always set cloud provider to null', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
      };

      const config = buildConfig(options);

      expect(config.cloud.provider).toBeNull();
    });

    it('should initialize services as empty array', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
      };

      const config = buildConfig(options);

      expect(config.services).toEqual([]);
    });
  });
});
