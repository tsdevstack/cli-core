import { describe, it, expect } from '@rstest/core';
import { buildDbInitSettingsSql } from './build-db-init-settings-sql';

describe('buildDbInitSettingsSql', () => {
  describe('Standard use cases', () => {
    it('should set every setting the db-init SQL reads', () => {
      expect(
        buildDbInitSettingsSql({
          owner: 'auth-service',
          app: 'auth-service_app',
          database: 'auth-service',
          ownerPassword: 'o',
          appPassword: 'a',
        }),
      ).toBe(
        [
          "SET tsdevstack.owner = 'auth-service';",
          "SET tsdevstack.app = 'auth-service_app';",
          "SET tsdevstack.database = 'auth-service';",
          "SET tsdevstack.owner_password = 'o';",
          "SET tsdevstack.app_password = 'a';",
        ].join('\n'),
      );
    });
  });

  describe('Edge cases', () => {
    it('should set a password left out to empty (the SQL leaves it)', () => {
      const sql = buildDbInitSettingsSql({
        owner: 'o',
        app: 'o_app',
        database: 'o',
      });
      expect(sql).toContain("SET tsdevstack.owner_password = '';");
      expect(sql).toContain("SET tsdevstack.app_password = '';");
    });

    it('should quote values with single quotes', () => {
      expect(
        buildDbInitSettingsSql({
          owner: 'o',
          app: 'o_app',
          database: 'o',
          appPassword: "a'b",
        }),
      ).toContain("SET tsdevstack.app_password = 'a''b';");
    });
  });
});
