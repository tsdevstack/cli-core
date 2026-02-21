import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockExecSync } = rs.hoisted(() => ({
  mockExecSync: rs.fn(),
}));

rs.mock('child_process', () => ({
  execSync: mockExecSync,
}));
rs.mock('../../logger', () => ({
  logger: {
    creating: rs.fn(),
    warn: rs.fn(),
  },
}));

import { recreateContainers } from './recreate-containers';
import { logger } from '../../logger';

describe('recreateContainers', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should recreate a single container with --force-recreate', () => {
      recreateContainers(['gateway'], '/project');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--force-recreate'),
        expect.objectContaining({ cwd: '/project' }),
      );
    });

    it('should include --wait flag by default', () => {
      recreateContainers(['gateway'], '/project');

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).toContain('--wait');
    });

    it('should include --remove-orphans only on first container', () => {
      recreateContainers(['gateway', 'redis'], '/project');

      const firstCommand = mockExecSync.mock.calls[0][0] as string;
      const secondCommand = mockExecSync.mock.calls[1][0] as string;

      expect(firstCommand).toContain('--remove-orphans');
      expect(secondCommand).not.toContain('--remove-orphans');
    });

    it('should include container name in the command', () => {
      recreateContainers(['redis'], '/project');

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).toContain('redis');
    });

    it('should use --no-deps to avoid recreating dependencies', () => {
      recreateContainers(['gateway'], '/project');

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).toContain('--no-deps');
    });

    it('should log creating message for each container', () => {
      recreateContainers(['gateway', 'redis'], '/project');

      expect(logger.creating).toHaveBeenCalledWith('Recreating gateway...');
      expect(logger.creating).toHaveBeenCalledWith('Recreating redis...');
    });
  });

  describe('Flag options', () => {
    it('should omit --wait when wait is false', () => {
      recreateContainers(['gateway'], '/project', false);

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).not.toContain('--wait');
    });

    it('should omit --remove-orphans when removeOrphans is false', () => {
      recreateContainers(['gateway'], '/project', true, false);

      const command = mockExecSync.mock.calls[0][0] as string;
      expect(command).not.toContain('--remove-orphans');
    });
  });

  describe('Error handling', () => {
    it('should warn and continue when a container fails to recreate', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('container not found');
      });

      recreateContainers(['missing', 'redis'], '/project');

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to recreate missing'),
      );
      // Should still try the second container
      expect(mockExecSync).toHaveBeenCalledTimes(2);
    });
  });
});
