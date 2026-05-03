import { describe, it, expect, rs, beforeEach, afterEach } from '@rstest/core';

const { mockSpawnSync } = rs.hoisted(() => ({
  mockSpawnSync: rs.fn(),
}));

rs.mock('child_process', () => ({
  spawnSync: mockSpawnSync,
}));

import { checkPrerequisites } from './check-prerequisites';

describe('checkPrerequisites', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  /**
   * Helper to mock `which` responses per command
   */
  function mockWhichResults(available: Record<string, boolean>): void {
    mockSpawnSync.mockImplementation((_cmd: string, args: string[]) => {
      const command = args[0];
      const isAvailable = available[command] ?? false;
      return {
        status: isAvailable ? 0 : 1,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        pid: 1234,
        output: [],
        signal: null,
      };
    });
  }

  describe('Standard use cases', () => {
    it('should return no errors or warnings when all tools are installed', () => {
      mockWhichResults({
        git: true,
        docker: true,
        terraform: true,
      });

      const result = checkPrerequisites();

      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should check git, docker, and terraform via which', () => {
      mockWhichResults({
        git: true,
        docker: true,
        terraform: true,
      });

      checkPrerequisites();

      expect(mockSpawnSync).toHaveBeenCalledWith('which', ['git'], {
        stdio: 'pipe',
      });
      expect(mockSpawnSync).toHaveBeenCalledWith('which', ['docker'], {
        stdio: 'pipe',
      });
      expect(mockSpawnSync).toHaveBeenCalledWith('which', ['terraform'], {
        stdio: 'pipe',
      });
    });
  });

  describe('Error cases', () => {
    it('should return error when git is not installed', () => {
      mockWhichResults({
        git: false,
        docker: true,
        terraform: true,
      });

      const result = checkPrerequisites();

      expect(result.errors).toContain('git is required but not installed');
    });
  });

  describe('Warning cases', () => {
    it('should return warning when Docker is not installed', () => {
      mockWhichResults({
        git: true,
        docker: false,
        terraform: true,
      });

      const result = checkPrerequisites();

      expect(result.warnings).toContain(
        'Docker not found — needed for local development',
      );
      expect(result.errors).toHaveLength(0);
    });

    it('should return warning when Terraform is not installed', () => {
      mockWhichResults({
        git: true,
        docker: true,
        terraform: false,
      });

      const result = checkPrerequisites();

      expect(result.warnings).toContain(
        'Terraform not found — needed for cloud deployment',
      );
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Multiple failures', () => {
    it('should accumulate errors and warnings', () => {
      mockWhichResults({
        git: false,
        docker: false,
        terraform: false,
      });

      const result = checkPrerequisites();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('git');
      expect(result.warnings).toHaveLength(2);
    });
  });

  describe('Node version', () => {
    const originalVersion = process.version;

    function setNodeVersion(version: string): void {
      Object.defineProperty(process, 'version', {
        value: version,
        configurable: true,
        writable: true,
      });
    }

    beforeEach(() => {
      mockWhichResults({ git: true, docker: true, terraform: true });
    });

    afterEach(() => {
      Object.defineProperty(process, 'version', {
        value: originalVersion,
        configurable: true,
        writable: true,
      });
    });

    it('should pass on Node 22', () => {
      setNodeVersion('v22.0.0');
      const result = checkPrerequisites();
      expect(result.errors.some((e) => e.includes('Node.js'))).toBe(false);
    });

    it('should pass on Node 24', () => {
      setNodeVersion('v24.0.0');
      const result = checkPrerequisites();
      expect(result.errors.some((e) => e.includes('Node.js'))).toBe(false);
    });

    it('should error on Node 20', () => {
      setNodeVersion('v20.10.0');
      const result = checkPrerequisites();
      expect(
        result.errors.some((e) => e.includes('Node.js') && e.includes('22')),
      ).toBe(true);
    });

    it('should error on Node 18', () => {
      setNodeVersion('v18.19.0');
      const result = checkPrerequisites();
      expect(
        result.errors.some((e) => e.includes('Node.js') && e.includes('22')),
      ).toBe(true);
    });
  });
});
