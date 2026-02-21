/**
 * Create service section structure for secrets file
 * Handles both frontend and backend services
 */

import type { FrameworkService } from '../config';
import type { ServiceSecrets } from './types';
import { FRONTEND_TYPES, FULL_STACK_FRONTEND_TYPES } from '../../constants';

/**
 * Create service section for a single service
 * Different structure for frontend vs backend services
 *
 * @param service - Service configuration
 * @returns Service secrets section object
 */
export function createServiceSection(
  service: FrameworkService,
): ServiceSecrets {
  const isFrontend = (FRONTEND_TYPES as readonly string[]).includes(
    service.type,
  );

  let secrets: string[] = [];

  if (isFrontend) {
    // All frontend services need API_URL
    secrets.push('API_URL');

    // Full-stack frontends (Next.js) also need TTL values for cookie maxAge
    if ((FULL_STACK_FRONTEND_TYPES as readonly string[]).includes(service.type)) {
      secrets.push('ACCESS_TOKEN_TTL');
      secrets.push('REFRESH_TOKEN_TTL');
    }
  } else {
    // Step 8: Backend services now get empty secrets array
    // Framework file provides all backend secrets (KONG_TRUST_TOKEN, service API keys, JWT keys for auth)
    secrets = [];
  }

  const serviceSecrets: ServiceSecrets = {
    secrets,
  };

  // API_KEY reference removed - now in framework file
  // ALLOWED_ORIGINS removed - apps are not called directly, everything goes through Kong

  return serviceSecrets;
}
