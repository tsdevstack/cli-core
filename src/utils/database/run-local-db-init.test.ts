import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockLoadServiceSecrets, mockRunLocalPsql, mockWarn } = rs.hoisted(
  () => ({
    mockLoadServiceSecrets: rs.fn(),
    mockRunLocalPsql: rs.fn(),
    mockWarn: rs.fn(),
  }),
);

rs.mock('../secrets', () => ({
  loadServiceSecrets: mockLoadServiceSecrets,
}));
rs.mock('./run-local-psql', () => ({
  runLocalPsql: mockRunLocalPsql,
}));
rs.mock('./read-db-init-sql', () => ({
  readDbInitSql: () => ({ server: '-- server', database: '-- database' }),
}));
rs.mock('../logger', () => ({
  logger: { warn: mockWarn, success: rs.fn() },
}));

import { runLocalDbInit } from './run-local-db-init';

describe('runLocalDbInit', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it("should run the server part, then the database part, as the container's owner", () => {
      mockLoadServiceSecrets.mockReturnValue({
        DATABASE_URL:
          'postgresql://auth-service_app:app%2Bpw@localhost:5432/auth-service',
        MIGRATION_DATABASE_URL:
          'postgresql://auth-service:owner-pw@localhost:5432/auth-service',
      });

      runLocalDbInit('/project', ['auth-service']);

      const settings = [
        "SET tsdevstack.owner = 'auth-service';",
        "SET tsdevstack.app = 'auth-service_app';",
        "SET tsdevstack.database = 'auth-service';",
        "SET tsdevstack.owner_password = '';",
        "SET tsdevstack.app_password = 'app+pw';",
      ].join('\n');
      expect(mockRunLocalPsql.mock.calls).toEqual([
        [
          '/project',
          'auth-db',
          'auth-service',
          'postgres',
          `${settings}\n-- server`,
        ],
        [
          '/project',
          'auth-db',
          'auth-service',
          'auth-service',
          `${settings}\n-- database`,
        ],
      ]);
    });

    it('should leave the owner password alone (the container was started with it)', () => {
      mockLoadServiceSecrets.mockReturnValue({
        DATABASE_URL: 'postgresql://a-service_app:x@localhost:5432/a-service',
        MIGRATION_DATABASE_URL:
          'postgresql://a-service:y@localhost:5432/a-service',
      });

      runLocalDbInit('/project', ['a-service']);

      expect(mockRunLocalPsql.mock.calls[0][4]).toContain(
        "SET tsdevstack.owner_password = '';",
      );
    });
  });

  describe('Edge cases', () => {
    it('should skip a service without database URLs', () => {
      mockLoadServiceSecrets.mockReturnValue(null);

      runLocalDbInit('/project', ['auth-service']);

      expect(mockRunLocalPsql).not.toHaveBeenCalled();
      expect(mockWarn).toHaveBeenCalledWith(
        '   Skipping auth-service: no database URLs in the local secrets',
      );
    });

    it("should skip a service whose DATABASE_URL isn't its app role's (an override)", () => {
      mockLoadServiceSecrets.mockReturnValue({
        DATABASE_URL: 'postgresql://someone:x@db.example.com:5432/shop',
        MIGRATION_DATABASE_URL:
          'postgresql://auth-service:y@localhost:5432/auth-service',
      });

      runLocalDbInit('/project', ['auth-service']);

      expect(mockRunLocalPsql).not.toHaveBeenCalled();
      expect(mockWarn).toHaveBeenCalledWith(
        "   Skipping auth-service: its DATABASE_URL doesn't use the app role auth-service_app",
      );
    });
  });
});
