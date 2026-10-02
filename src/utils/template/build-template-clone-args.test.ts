import { describe, it, expect } from '@rstest/core';
import { buildTemplateCloneArgs } from './build-template-clone-args';

describe('buildTemplateCloneArgs', () => {
  const REPO_URL = 'https://github.com/tsdevstack/some-template.git';
  const TARGET_PATH = '/fake/project/apps/my-service';

  describe('Standard use cases', () => {
    it('should pin the clone to the given ref', () => {
      expect(buildTemplateCloneArgs(REPO_URL, TARGET_PATH, 'v0.7.0')).toEqual([
        'clone',
        '--depth',
        '1',
        '--branch',
        'v0.7.0',
        REPO_URL,
        TARGET_PATH,
      ]);
    });

    it('should clone the default branch when no ref is given', () => {
      expect(buildTemplateCloneArgs(REPO_URL, TARGET_PATH)).toEqual([
        'clone',
        '--depth',
        '1',
        REPO_URL,
        TARGET_PATH,
      ]);
    });
  });

  describe('Edge cases', () => {
    it('should treat an empty ref as no ref', () => {
      expect(buildTemplateCloneArgs(REPO_URL, TARGET_PATH, '')).toEqual([
        'clone',
        '--depth',
        '1',
        REPO_URL,
        TARGET_PATH,
      ]);
    });
  });
});
