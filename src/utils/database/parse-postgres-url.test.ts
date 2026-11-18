import { describe, it, expect } from '@rstest/core';
import { parsePostgresUrl } from './parse-postgres-url';

describe('parsePostgresUrl', () => {
  describe('Standard use cases', () => {
    it('should split a local URL', () => {
      expect(
        parsePostgresUrl(
          'postgresql://auth-service_app:secret@localhost:5433/auth-service',
        ),
      ).toEqual({
        user: 'auth-service_app',
        password: 'secret',
        host: 'localhost',
        port: 5433,
        database: 'auth-service',
      });
    });

    it('should decode a base64 password', () => {
      expect(
        parsePostgresUrl('postgresql://u:a%2Fb%2Bc%3D@db:5432/d').password,
      ).toBe('a/b+c=');
    });
  });

  describe('Edge cases', () => {
    it('should default the port to 5432 and accept postgres://', () => {
      const parts = parsePostgresUrl(
        'postgres://u:p@db.internal/d?sslmode=require',
      );
      expect(parts.port).toBe(5432);
      expect(parts.database).toBe('d');
    });

    it.each([
      ['not a URL', 'oops'],
      ['another scheme', 'mysql://u:p@h:3306/d'],
      ['no password', 'postgresql://u@h:5432/d'],
      ['no database', 'postgresql://u:p@h:5432/'],
    ])('should refuse %s without showing the URL', (_case, url) => {
      expect(() => parsePostgresUrl(url)).toThrow('Invalid database URL');
      try {
        parsePostgresUrl(url);
      } catch (error) {
        expect(JSON.stringify(error)).not.toContain(url);
      }
    });
  });
});
