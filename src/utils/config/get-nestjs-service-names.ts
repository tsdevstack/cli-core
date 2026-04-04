/**
 * Get NestJS Service Names
 *
 * Filters framework config services to return only NestJS service names.
 */

import type { FrameworkService } from './types';

export function getNestjsServiceNames(services: FrameworkService[]): string[] {
  return services.filter((s) => s.type === 'nestjs').map((s) => s.name);
}
