import { logger } from './logger';
import {
  LOCAL_STORAGE_ACCESS_KEY,
  LOCAL_STORAGE_CONSOLE_PORT,
  LOCAL_STORAGE_SECRET_KEY,
} from '../../constants';

/**
 * Print infrastructure URLs after sync or startup
 */
export function printInfrastructureUrls(options?: { storage?: boolean }): void {
  logger.ready('Infrastructure is ready!');
  logger.info('   - Kong Proxy: http://localhost:8000');
  logger.info('   - Kong Admin: http://localhost:8001');
  logger.info(
    '   - pgAdmin: http://localhost:5050 (admin@localhost.com / admin)',
  );
  logger.info('   - Redis Commander: http://localhost:8081');
  logger.info('   - Grafana: http://localhost:4001 (admin / admin)');
  logger.info('   - Prometheus: http://localhost:9090');
  logger.info('   - Jaeger: http://localhost:16686');
  if (options?.storage) {
    logger.info(
      `   - RustFS console: http://localhost:${LOCAL_STORAGE_CONSOLE_PORT} (${LOCAL_STORAGE_ACCESS_KEY} / ${LOCAL_STORAGE_SECRET_KEY})`,
    );
  }
}
