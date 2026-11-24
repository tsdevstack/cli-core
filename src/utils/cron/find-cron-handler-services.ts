import * as fs from 'fs';
import * as path from 'path';
import {
  APPS_DIR,
  CRON_HANDLER_DIR,
  CRON_HANDLER_SUFFIX,
} from '../../constants';
import type { FrameworkService } from '../config/types';

/**
 * The NestJS services of the project that have a handler file for a cron
 * job: apps/{service}/src/cron/{name}.cron.ts
 *
 * @param projectRoot - The project root
 * @param jobName - The cron job's name
 * @param services - The services from config.json
 */
export function findCronHandlerServices(
  projectRoot: string,
  jobName: string,
  services: FrameworkService[],
): string[] {
  return services
    .filter(
      (service) =>
        service.type === 'nestjs' &&
        fs.existsSync(
          path.join(
            projectRoot,
            APPS_DIR,
            service.name,
            CRON_HANDLER_DIR,
            `${jobName}${CRON_HANDLER_SUFFIX}`,
          ),
        ),
    )
    .map((service) => service.name);
}
