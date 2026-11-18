import { describe, it, expect } from '@rstest/core';
import { readDbInitSql } from './read-db-init-sql';

describe('readDbInitSql', () => {
  describe('Standard use cases', () => {
    it('should read the server part from the CLI templates', () => {
      const { server } = readDbInitSql();
      expect(server).toContain("current_setting('tsdevstack.owner')");
      expect(server).toContain('REVOKE ALL ON DATABASE %I FROM PUBLIC');
    });

    it('should read the database part from the CLI templates', () => {
      const { database } = readDbInitSql();
      expect(database).toContain('ALTER DEFAULT PRIVILEGES FOR ROLE %I');
    });
  });

  describe('Edge cases', () => {
    it('should give each part as one statement (psql and the jobs send it whole)', () => {
      const { server, database } = readDbInitSql();
      for (const part of [server, database]) {
        expect(part.match(/^DO \$db_init\$$/gm)).toHaveLength(1);
        expect(part.trimEnd().endsWith('$db_init$;')).toBe(true);
      }
    });
  });
});
