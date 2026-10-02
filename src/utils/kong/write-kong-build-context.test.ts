import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { mockResolveCliAssetDir } = rs.hoisted(() => ({
  mockResolveCliAssetDir: rs.fn(),
}));

rs.mock('../paths/resolve-cli-asset-dir', () => ({
  resolveCliAssetDir: mockResolveCliAssetDir,
}));

import { writeKongBuildContext } from './write-kong-build-context';
import { generateKongDockerignore } from './generate-kong-dockerignore';

describe('writeKongBuildContext', () => {
  let tempDir: string;
  let projectRoot: string;
  let contextDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'write-kong-context-'));
    const frameworkDir = path.join(tempDir, 'cli-templates', 'kong-plugins');
    fs.mkdirSync(path.join(frameworkDir, 'tsdevstack-fw'), { recursive: true });
    fs.writeFileSync(
      path.join(frameworkDir, 'tsdevstack-fw', 'handler.lua'),
      '',
    );
    fs.writeFileSync(
      path.join(frameworkDir, 'tsdevstack-fw', 'schema.lua'),
      '',
    );
    projectRoot = path.join(tempDir, 'project');
    fs.mkdirSync(path.join(projectRoot, 'kong-plugins', 'my-plugin'), {
      recursive: true,
    });
    for (const file of ['handler.lua', 'schema.lua']) {
      fs.writeFileSync(
        path.join(projectRoot, 'kong-plugins', 'my-plugin', file),
        '',
      );
    }
    contextDir = path.join(tempDir, 'context');
    mockResolveCliAssetDir.mockReset();
    mockResolveCliAssetDir.mockReturnValue(frameworkDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  const read = (...parts: string[]): string =>
    fs.readFileSync(path.join(contextDir, ...parts), 'utf-8');

  describe('Local build (no baked config)', () => {
    it('should write Dockerfile, .dockerignore, plugins and an empty declarative/', () => {
      const plugins = writeKongBuildContext({ projectRoot, contextDir });

      expect(plugins).toEqual([
        'bundled',
        'oidc',
        'tsdevstack-fw',
        'my-plugin',
      ]);
      expect(read('Dockerfile')).toContain(
        'ENV KONG_PLUGINS=bundled,oidc,tsdevstack-fw,my-plugin',
      );
      expect(read('Dockerfile')).not.toContain('WAKEUP_LAMBDA_URL');
      expect(read('.dockerignore')).toBe(generateKongDockerignore());
      expect(
        fs.readdirSync(path.join(contextDir, 'kong-plugins')).sort(),
      ).toEqual(['my-plugin', 'tsdevstack-fw']);
      expect(fs.readdirSync(path.join(contextDir, 'declarative'))).toEqual([]);
    });

    it('should keep other files in the context (e.g. infrastructure/kong/<env>/kong.yml)', () => {
      fs.mkdirSync(path.join(contextDir, 'dev'), { recursive: true });
      fs.writeFileSync(path.join(contextDir, 'dev', 'kong.yml'), 'keep');

      writeKongBuildContext({ projectRoot, contextDir });

      expect(read('dev', 'kong.yml')).toBe('keep');
    });

    it('should remove a stale declarative kong.yml', () => {
      fs.mkdirSync(path.join(contextDir, 'declarative'), { recursive: true });
      fs.writeFileSync(path.join(contextDir, 'declarative', 'kong.yml'), 'old');

      writeKongBuildContext({ projectRoot, contextDir });

      expect(fs.readdirSync(path.join(contextDir, 'declarative'))).toEqual([]);
    });
  });

  describe('Cloud build (config baked in)', () => {
    it('should write kong.yml into declarative/ and pass the upload size', () => {
      writeKongBuildContext({
        projectRoot,
        contextDir,
        maxUploadSize: '50m',
        kongYml: '_format_version: "3.0"\n',
      });

      expect(read('declarative', 'kong.yml')).toBe('_format_version: "3.0"\n');
      expect(read('Dockerfile')).toContain(
        'KONG_NGINX_HTTP_CLIENT_MAX_BODY_SIZE=50m',
      );
    });
  });
});
