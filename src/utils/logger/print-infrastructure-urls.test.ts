import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('./logger', () => ({
  logger: {
    ready: rs.fn(),
    info: rs.fn(),
  },
}));

import { printInfrastructureUrls } from './print-infrastructure-urls';
import { logger } from './logger';

describe('printInfrastructureUrls', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should log ready message', () => {
    printInfrastructureUrls();

    expect(logger.ready).toHaveBeenCalledWith('Infrastructure is ready!');
  });

  it('should log all infrastructure URLs', () => {
    printInfrastructureUrls();

    const infoCalls = rs.mocked(logger.info).mock.calls.map((c) => c[0]);

    expect(infoCalls).toContainEqual(
      expect.stringContaining('http://localhost:8000'),
    );
    expect(infoCalls).toContainEqual(
      expect.stringContaining('http://localhost:8001'),
    );
    expect(infoCalls).toContainEqual(
      expect.stringContaining('http://localhost:5050'),
    );
    expect(infoCalls).toContainEqual(
      expect.stringContaining('http://localhost:8081'),
    );
    expect(infoCalls).toContainEqual(
      expect.stringContaining('http://localhost:4001'),
    );
    expect(infoCalls).toContainEqual(
      expect.stringContaining('http://localhost:9090'),
    );
    expect(infoCalls).toContainEqual(
      expect.stringContaining('http://localhost:16686'),
    );
  });

  it('should log Kong Proxy and Admin URLs', () => {
    printInfrastructureUrls();

    const infoCalls = rs.mocked(logger.info).mock.calls.map((c) => c[0]);

    expect(infoCalls).toContainEqual(expect.stringContaining('Kong Proxy'));
    expect(infoCalls).toContainEqual(expect.stringContaining('Kong Admin'));
  });

  it('should log 7 info lines for all services', () => {
    printInfrastructureUrls();

    expect(logger.info).toHaveBeenCalledTimes(7);
  });
});
