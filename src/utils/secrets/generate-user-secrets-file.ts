/**
 * Generate .secrets.user.json
 */

import { type FrameworkConfig, hasAuthTemplate } from '../config';
import type { SecretsFile } from './types';
import { autoDetectAllowedOrigins } from './auto-detect-allowed-origins';
import { createServiceSection } from './create-service-section';
import { addJwtKeysToAuthService } from './add-jwt-keys-to-auth-service';
import { KONG_SERVICE_HOST, KONG_GATEWAY_URL } from '../../constants';

/**
 * Generate .secrets.user.json
 * This file is preserved if it exists, only created if missing
 *
 * @param config - Framework configuration
 * @returns Generated user secrets file
 */
export function generateUserSecretsFile(config: FrameworkConfig): SecretsFile {
  const allowedOrigins = autoDetectAllowedOrigins(config);
  const useAuthTemplate = hasAuthTemplate(config);

  // User file contains only user-configurable values
  // Framework-generated secrets (JWT keys, service API keys, service URLs) are in framework file
  const secrets: Record<string, string> = {
    DOMAIN: '', // Set for cloud deployment (e.g., example.com). API will be api.{DOMAIN}
    APP_URL: '', // Frontend URL for email links (e.g., http://localhost:3000 or https://app.example.com)
    KONG_SERVICE_HOST,
    API_URL: KONG_GATEWAY_URL,
    ACCESS_TOKEN_TTL: '900', // 15 minutes
    REFRESH_TOKEN_TTL: '604800', // 7 days
    CONFIRMATION_TOKEN_TTL: '86400', // 24 hours (in seconds)
  };

  // Only add KONG_CORS_ORIGINS if there are frontend services
  if (allowedOrigins) {
    secrets.KONG_CORS_ORIGINS = allowedOrigins;
  }

  const file: SecretsFile = {
    $comment:
      'YOUR CUSTOM SECRETS - Edit this file freely, then run: npx tsdevstack generate-secrets',
    $instructions: {
      '1': "Add your custom secrets to the 'secrets' section below",
      '2': "Reference them in service 'secrets' arrays",
      '3': 'After editing, run: npx tsdevstack generate-secrets',
      '4': 'Restart your services to pick up changes',
    },
    $important: {
      safe_to_edit: 'This file (.secrets.user.json) is SAFE to edit - your changes will be preserved',
      local_only:
        'ALLOWED_ORIGINS here are for LOCAL development (http://localhost:*)',
      framework_secrets:
        'Service URLs and API keys are auto-generated in .secrets.tsdevstack.json and available to all backend services',
    },
    secrets,
  };

  // Add service structures using helper
  for (const service of config.services) {
    file[service.name] = createServiceSection(service);
  }

  // Add JWT keys to auth service if auth template is enabled
  addJwtKeysToAuthService(file, useAuthTemplate);

  return file;
}
