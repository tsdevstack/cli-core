/**
 * Write a Kong image build context (local and cloud)
 */

import * as fs from 'fs';
import * as path from 'path';
import { KONG_DECLARATIVE_DIR } from '../../constants';
import { generateKongDockerfile } from './generate-kong-dockerfile';
import { generateKongDockerignore } from './generate-kong-dockerignore';
import { stageKongPlugins } from './stage-kong-plugins';

export interface WriteKongBuildContextOptions {
  /** Project root (its kong-plugins/ folder holds the project plugins) */
  projectRoot: string;
  /** Build context directory (infrastructure/kong locally, a temp dir in the cloud) */
  contextDir: string;
  /** Max upload size (nginx client_max_body_size). Default: "10m" */
  maxUploadSize?: string;
  /**
   * Resolved kong.yml content to bake into the image (cloud).
   * Omit for local builds, where the config is mounted at runtime.
   */
  kongYml?: string;
}

/**
 * Writes `Dockerfile`, `.dockerignore`, `kong-plugins/` (framework and
 * project plugins) and `declarative/` (with kong.yml when given) into the
 * build context.
 *
 * @returns The KONG_PLUGINS list baked into the image
 */
export function writeKongBuildContext(
  options: WriteKongBuildContextOptions,
): string[] {
  fs.mkdirSync(options.contextDir, { recursive: true });

  const kongPlugins = stageKongPlugins({
    projectRoot: options.projectRoot,
    contextDir: options.contextDir,
  });

  const declarativeDir = path.join(options.contextDir, KONG_DECLARATIVE_DIR);
  fs.rmSync(declarativeDir, { recursive: true, force: true });
  fs.mkdirSync(declarativeDir, { recursive: true });
  if (options.kongYml !== undefined) {
    fs.writeFileSync(path.join(declarativeDir, 'kong.yml'), options.kongYml);
  }

  fs.writeFileSync(
    path.join(options.contextDir, 'Dockerfile'),
    generateKongDockerfile({
      maxUploadSize: options.maxUploadSize,
      kongPlugins,
    }),
  );
  fs.writeFileSync(
    path.join(options.contextDir, '.dockerignore'),
    generateKongDockerignore(),
  );

  return kongPlugins;
}
