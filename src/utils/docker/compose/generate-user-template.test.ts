import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('fs', { mock: true });
rs.mock('../../fs', () => ({
  isFile: rs.fn(),
}));
rs.mock('../../logger', () => ({
  logger: {
    info: rs.fn(),
    success: rs.fn(),
  },
}));

import * as fs from 'fs';
import { isFile } from '../../fs';
import { logger } from '../../logger';
import { generateUserComposeTemplate } from './generate-user-template';

describe('generateUserComposeTemplate', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should write docker-compose.user.yml when it does not exist', () => {
      rs.mocked(isFile).mockReturnValue(false);

      generateUserComposeTemplate('/project', 'my-network');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/project/docker-compose.user.yml',
        expect.stringContaining('docker-compose.user.yml'),
        'utf-8',
      );
    });

    it('should include network name in template content', () => {
      rs.mocked(isFile).mockReturnValue(false);

      generateUserComposeTemplate('/project', 'my-network');

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('my-network'),
        'utf-8',
      );
    });

    it('should log success after writing', () => {
      rs.mocked(isFile).mockReturnValue(false);

      generateUserComposeTemplate('/project', 'net');

      expect(logger.success).toHaveBeenCalledWith(
        expect.stringContaining('docker-compose.user.yml'),
      );
    });
  });

  describe('Edge cases', () => {
    it('should not overwrite if file already exists', () => {
      rs.mocked(isFile).mockReturnValue(true);

      generateUserComposeTemplate('/project', 'net');

      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should log info message when file already exists', () => {
      rs.mocked(isFile).mockReturnValue(true);

      generateUserComposeTemplate('/project', 'net');

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('already exists'),
      );
    });
  });
});
