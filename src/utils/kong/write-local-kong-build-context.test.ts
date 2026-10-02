import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const { mockWriteKongBuildContext, mockLogger } = rs.hoisted(() => ({
  mockWriteKongBuildContext: rs.fn(),
  mockLogger: {
    info: rs.fn(),
    success: rs.fn(),
    warn: rs.fn(),
    newline: rs.fn(),
  },
}));

rs.mock('./write-kong-build-context', () => ({
  writeKongBuildContext: mockWriteKongBuildContext,
}));
rs.mock('../logger', () => ({ logger: mockLogger }));

import { writeLocalKongBuildContext } from './write-local-kong-build-context';
import { generateKongDockerfile } from './generate-kong-dockerfile';

describe('writeLocalKongBuildContext', () => {
  let rootDir: string;
  let dockerfilePath: string;

  beforeEach(() => {
    rs.clearAllMocks();
    mockWriteKongBuildContext.mockReturnValue(['bundled', 'oidc', 'my-plugin']);
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-kong-context-'));
    dockerfilePath = path.join(rootDir, 'infrastructure', 'kong', 'Dockerfile');
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('should write the build context into infrastructure/kong without a baked config', () => {
    writeLocalKongBuildContext(rootDir);

    expect(mockWriteKongBuildContext).toHaveBeenCalledWith({
      projectRoot: rootDir,
      contextDir: path.join(rootDir, 'infrastructure', 'kong'),
    });
  });

  it('should log the resulting KONG_PLUGINS', () => {
    writeLocalKongBuildContext(rootDir);

    expect(mockLogger.success).toHaveBeenCalledWith(
      expect.stringContaining('KONG_PLUGINS=bundled,oidc,my-plugin'),
    );
  });

  it('should propagate collision errors', () => {
    mockWriteKongBuildContext.mockImplementation(() => {
      throw new Error('collision');
    });

    expect(() => writeLocalKongBuildContext(rootDir)).toThrow('collision');
  });

  describe('Existing Dockerfile', () => {
    it('should not warn when there is no Dockerfile yet', () => {
      writeLocalKongBuildContext(rootDir);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should not warn when the Dockerfile was generated', () => {
      fs.mkdirSync(path.dirname(dockerfilePath), { recursive: true });
      fs.writeFileSync(dockerfilePath, generateKongDockerfile());

      writeLocalKongBuildContext(rootDir);

      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should warn before overwriting a hand-written Dockerfile', () => {
      fs.mkdirSync(path.dirname(dockerfilePath), { recursive: true });
      fs.writeFileSync(dockerfilePath, 'FROM kong:3.8\nRUN custom-step\n');

      writeLocalKongBuildContext(rootDir);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('now generated'),
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('kong-plugins/'),
      );
      const warnOrder = mockLogger.warn.mock.invocationCallOrder[0];
      const writeOrder = mockWriteKongBuildContext.mock.invocationCallOrder[0];
      expect(warnOrder).toBeLessThan(writeOrder);
    });
  });
});
