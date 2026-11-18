import { describe, it, expect } from '@rstest/core';
import { pickOwnerDatabaseUrl } from './pick-owner-database-url';

describe('pickOwnerDatabaseUrl', () => {
  describe('Standard use cases', () => {
    it('should pick MIGRATION_DATABASE_URL over the app role DATABASE_URL', () => {
      expect(
        pickOwnerDatabaseUrl({
          DATABASE_URL: 'postgresql://s_app:a@localhost:5432/s',
          MIGRATION_DATABASE_URL: 'postgresql://s:o@localhost:5432/s',
        }),
      ).toBe('postgresql://s:o@localhost:5432/s');
    });

    it('should fall back to DATABASE_URL in secrets made before the app role', () => {
      expect(
        pickOwnerDatabaseUrl({
          DATABASE_URL: 'postgresql://s:o@localhost:5432/s',
        }),
      ).toBe('postgresql://s:o@localhost:5432/s');
    });
  });

  describe('Edge cases', () => {
    it.each([
      ['no section', undefined],
      ['null', null],
      ['a string', 'x'],
      ['no URLs', { PORT: '3001' }],
      ['empty URLs', { DATABASE_URL: '', MIGRATION_DATABASE_URL: '' }],
      ['non-string URLs', { DATABASE_URL: 1, MIGRATION_DATABASE_URL: true }],
    ])('should return undefined for %s', (_case, section) => {
      expect(pickOwnerDatabaseUrl(section)).toBeUndefined();
    });
  });
});
