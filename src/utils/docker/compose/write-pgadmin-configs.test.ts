import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockWriteJsonFile } = rs.hoisted(() => ({
  mockWriteJsonFile: rs.fn(),
}));

rs.mock('fs', { mock: true });
rs.mock('../../fs', () => ({
  writeJsonFile: mockWriteJsonFile,
}));

import * as fs from 'fs';
import { writePgAdminConfigs } from './write-pgadmin-configs';
import type { FrameworkService } from '../../config';

function makeService(
  name: string,
  hasDatabase: boolean = true,
): FrameworkService {
  return { name, type: 'nestjs', port: 3000, hasDatabase };
}

describe('writePgAdminConfigs', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('servers.json generation', () => {
    it('should write pgadmin-servers.json with server entries', () => {
      const services = [makeService('auth-service')];
      const secrets = { AUTH_DB_USER: 'authuser', AUTH_DB_PASSWORD: 'pass' };

      writePgAdminConfigs('/root', services, secrets);

      expect(mockWriteJsonFile).toHaveBeenCalledWith(
        '/root/pgadmin-servers.json',
        {
          Servers: {
            'Server 1': expect.objectContaining({
              Name: 'auth (local)',
              Host: 'auth-db',
              Port: 5432,
              MaintenanceDB: 'auth-service',
              Username: 'authuser',
            }),
          },
        },
      );
    });

    it('should number servers sequentially', () => {
      const services = [
        makeService('auth-service'),
        makeService('offers-service'),
      ];
      const secrets = {
        AUTH_DB_USER: 'u1',
        AUTH_DB_PASSWORD: 'p1',
        OFFERS_DB_USER: 'u2',
        OFFERS_DB_PASSWORD: 'p2',
      };

      writePgAdminConfigs('/root', services, secrets);

      const call = mockWriteJsonFile.mock.calls[0];
      const servers = (call[1] as { Servers: Record<string, unknown> }).Servers;

      expect(servers).toHaveProperty('Server 1');
      expect(servers).toHaveProperty('Server 2');
    });

    it('should use service name as fallback username', () => {
      const services = [makeService('auth-service')];

      writePgAdminConfigs('/root', services, {});

      expect(mockWriteJsonFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          Servers: {
            'Server 1': expect.objectContaining({
              Username: 'auth-service',
            }),
          },
        }),
      );
    });

    it('should skip services without database', () => {
      const services = [
        makeService('auth-service', true),
        makeService('bff-service', false),
      ];
      const secrets = { AUTH_DB_USER: 'u', AUTH_DB_PASSWORD: 'p' };

      writePgAdminConfigs('/root', services, secrets);

      const call = mockWriteJsonFile.mock.calls[0];
      const servers = (call[1] as { Servers: Record<string, unknown> }).Servers;

      expect(Object.keys(servers)).toHaveLength(1);
    });
  });

  describe('pgpass file generation', () => {
    it('should write pgadmin-pgpass file', () => {
      const services = [makeService('auth-service')];
      const secrets = { AUTH_DB_USER: 'authuser', AUTH_DB_PASSWORD: 'secret' };

      writePgAdminConfigs('/root', services, secrets);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/root/pgadmin-pgpass',
        'auth-db:5432:auth-service:authuser:secret\n',
        'utf-8',
      );
    });

    it('should set 600 permissions on pgpass file', () => {
      const services = [makeService('auth-service')];
      const secrets = { AUTH_DB_USER: 'u', AUTH_DB_PASSWORD: 'p' };

      writePgAdminConfigs('/root', services, secrets);

      expect(fs.chmodSync).toHaveBeenCalledWith('/root/pgadmin-pgpass', 0o600);
    });

    it('should include multiple database entries in pgpass', () => {
      const services = [
        makeService('auth-service'),
        makeService('offers-service'),
      ];
      const secrets = {
        AUTH_DB_USER: 'u1',
        AUTH_DB_PASSWORD: 'p1',
        OFFERS_DB_USER: 'u2',
        OFFERS_DB_PASSWORD: 'p2',
      };

      writePgAdminConfigs('/root', services, secrets);

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        '/root/pgadmin-pgpass',
        'auth-db:5432:auth-service:u1:p1\noffers-db:5432:offers-service:u2:p2\n',
        'utf-8',
      );
    });
  });
});
