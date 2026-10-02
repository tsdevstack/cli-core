import { describe, it, expect } from '@rstest/core';
import { buildKongPluginList } from './build-kong-plugin-list';
import { CliError } from '../errors';
import { KONG_BUNDLED_PLUGINS } from '../../constants';

describe('buildKongPluginList', () => {
  describe('Standard use cases', () => {
    it('should start with bundled and oidc', () => {
      expect(
        buildKongPluginList({ frameworkPlugins: [], userPlugins: [] }),
      ).toEqual(['bundled', 'oidc']);
    });

    it('should append framework plugins, then project plugins', () => {
      expect(
        buildKongPluginList({
          frameworkPlugins: ['tsdevstack-a', 'tsdevstack-b'],
          userPlugins: ['my-plugin', 'other-plugin'],
        }),
      ).toEqual([
        'bundled',
        'oidc',
        'tsdevstack-a',
        'tsdevstack-b',
        'my-plugin',
        'other-plugin',
      ]);
    });
  });

  describe('Name collisions', () => {
    it('should fail when a project plugin reuses a bundled plugin name', () => {
      expect(() =>
        buildKongPluginList({
          frameworkPlugins: [],
          userPlugins: ['rate-limiting'],
        }),
      ).toThrow(CliError);
    });

    it('should reject every bundled plugin name', () => {
      for (const name of KONG_BUNDLED_PLUGINS) {
        expect(() =>
          buildKongPluginList({ frameworkPlugins: [], userPlugins: [name] }),
        ).toThrow(/collision/);
      }
    });

    it('should fail when a project plugin is named oidc', () => {
      expect(() =>
        buildKongPluginList({ frameworkPlugins: [], userPlugins: ['oidc'] }),
      ).toThrow(CliError);
    });

    it('should fail when a project plugin reuses a framework plugin name', () => {
      expect(() =>
        buildKongPluginList({
          frameworkPlugins: ['tsdevstack-a'],
          userPlugins: ['tsdevstack-a'],
        }),
      ).toThrow(CliError);
    });

    it('should list every colliding name and give a rename hint', () => {
      let error: unknown;
      try {
        buildKongPluginList({
          frameworkPlugins: ['tsdevstack-a'],
          userPlugins: ['cors', 'fine', 'tsdevstack-a'],
        });
      } catch (e) {
        error = e;
      }
      expect(error).toBeInstanceOf(CliError);
      const cliError = error as CliError;
      expect(cliError.message).toContain('cors, tsdevstack-a');
      expect(cliError.message).not.toContain('fine');
      expect(cliError.hint).toContain('Rename');
      expect(cliError.hint).toContain('kong-plugins/');
    });

    it('should fail when a framework plugin collides with a bundled plugin', () => {
      expect(() =>
        buildKongPluginList({ frameworkPlugins: ['cors'], userPlugins: [] }),
      ).toThrow(CliError);
    });

    it('should reject the reserved word "bundled"', () => {
      expect(() =>
        buildKongPluginList({ frameworkPlugins: [], userPlugins: ['bundled'] }),
      ).toThrow(CliError);
    });
  });
});
