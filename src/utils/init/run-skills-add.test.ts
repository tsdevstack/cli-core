import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('child_process', { mock: true });

import { spawnSync } from 'child_process';
import { runSkillsAdd } from './run-skills-add';

function mockStatus(status: number | null): void {
  rs.mocked(spawnSync).mockReturnValue({
    status,
  } as unknown as ReturnType<typeof spawnSync>);
}

describe('runSkillsAdd', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('runs npx skills add in the project with the terminal attached', () => {
      mockStatus(0);

      runSkillsAdd('/tmp/proj', ['tsdevstack/skills', '-a', 'codex', '-y']);

      expect(spawnSync).toHaveBeenCalledWith(
        'npx',
        ['skills', 'add', 'tsdevstack/skills', '-a', 'codex', '-y'],
        { cwd: '/tmp/proj', stdio: 'inherit' },
      );
    });

    it('returns true when the skills CLI exits with 0', () => {
      mockStatus(0);

      expect(runSkillsAdd('/tmp/proj', ['tsdevstack/skills'])).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('returns false when the skills CLI fails', () => {
      mockStatus(1);

      expect(runSkillsAdd('/tmp/proj', ['tsdevstack/skills'])).toBe(false);
    });

    it('returns false when npx could not run (no exit status)', () => {
      mockStatus(null);

      expect(runSkillsAdd('/tmp/proj', ['tsdevstack/skills'])).toBe(false);
    });
  });
});
