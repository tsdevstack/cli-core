/**
 * Generate .secrets.tsdevstack.json
 */

import { type FrameworkConfig, hasAuthTemplate } from '../config';
import { CliError } from '../errors';
import type { SecretsFile, Secrets } from './types';
import { generateDatabaseSecrets } from './generate-database-secrets';
import { generateBase64Secret } from './generate-base64-secret';
import { generateHexSecret } from './generate-hex-secret';
import { generateRSAKeyPair } from './generate-rsa-keypair';
import { generateServiceUrls } from './generate-service-urls';
import {
  LOCAL_REDIS_HOST,
  LOCAL_REDIS_PORT,
  LOCAL_REDIS_PASSWORD,
  CLIENT_SIDE_FRONTEND_TYPES,
  BACKEND_DEFAULT_SECRETS,
  KONG_SSL_VERIFY,
  KONG_GATEWAY_URL,
} from '../../constants';

/**
 * Generate .secrets.tsdevstack.json
 * This file is regenerated and preserves existing framework secrets (REFRESH_TOKEN_SECRET)
 * Database and Redis credentials use hardcoded values for local development
 *
 * @param config - Framework configuration
 * @param existingFrameworkSecrets - Existing framework secrets to preserve
 * @returns Generated framework secrets file
 */
export function generateFrameworkSecretsFile(
  config: FrameworkConfig,
  existingFrameworkSecrets?: SecretsFile | null,
): SecretsFile {
  const useAuthTemplate = hasAuthTemplate(config);

  // Preserve existing framework secrets, or generate new ones
  let frameworkSecrets: Secrets;

  if (existingFrameworkSecrets?.secrets) {
    // Always preserve these base secrets
    frameworkSecrets = {
      NODE_ENV: 'development',
      SECRETS_PROVIDER: 'local',
      LOG_LEVEL: 'debug',
    };

    const existing = existingFrameworkSecrets.secrets;

    // Step 1: Preserve or generate JWT keys and auth secrets (when useAuthTemplate=true)
    if (useAuthTemplate) {
      // Preserve existing JWT keys, or generate new ones if missing
      const existingJwtPrivateKey = existing.JWT_PRIVATE_KEY_CURRENT;
      const existingJwtPublicKey = existing.JWT_PUBLIC_KEY_CURRENT;
      const existingJwtKeyId = existing.JWT_KEY_ID_CURRENT;
      const existingRefreshSecret = existing.REFRESH_TOKEN_SECRET;
      const existingBcryptRounds = existing.BCRYPT_ROUNDS;

      if (
        typeof existingJwtPrivateKey === 'string' &&
        existingJwtPrivateKey &&
        typeof existingJwtPublicKey === 'string' &&
        existingJwtPublicKey &&
        typeof existingJwtKeyId === 'string' &&
        existingJwtKeyId
      ) {
        // Preserve existing JWT keys
        frameworkSecrets.JWT_PRIVATE_KEY_CURRENT = existingJwtPrivateKey;
        frameworkSecrets.JWT_PUBLIC_KEY_CURRENT = existingJwtPublicKey;
        frameworkSecrets.JWT_KEY_ID_CURRENT = existingJwtKeyId;
      } else {
        // Generate new JWT keys
        const { privateKey, publicKey, keyId } = generateRSAKeyPair();
        frameworkSecrets.JWT_PRIVATE_KEY_CURRENT = privateKey;
        frameworkSecrets.JWT_PUBLIC_KEY_CURRENT = publicKey;
        frameworkSecrets.JWT_KEY_ID_CURRENT = keyId;
      }

      frameworkSecrets.REFRESH_TOKEN_SECRET =
        (typeof existingRefreshSecret === 'string' && existingRefreshSecret) ||
        generateBase64Secret(32);

      frameworkSecrets.BCRYPT_ROUNDS =
        (typeof existingBcryptRounds === 'string' && existingBcryptRounds) ||
        '12';
    }

    // Step 2: Preserve or generate KONG_TRUST_TOKEN (always, not conditional)
    const existingKongToken = existing.KONG_TRUST_TOKEN;
    frameworkSecrets.KONG_TRUST_TOKEN =
      (typeof existingKongToken === 'string' && existingKongToken) ||
      generateHexSecret(32);

    // Step 3: Preserve or generate service API keys (always, for all backend services)
    for (const service of config.services) {
      const isFrontend =
        (CLIENT_SIDE_FRONTEND_TYPES as readonly string[]).includes(
          service.type,
        ) || service.type === 'nextjs';
      if (!isFrontend) {
        const keyName = `${service.name.toUpperCase().replace(/-/g, '_')}_API_KEY`;
        const existingApiKey = existing[keyName];
        frameworkSecrets[keyName] =
          (typeof existingApiKey === 'string' && existingApiKey) ||
          generateHexSecret(32);
      }
    }
  } else {
    // No existing secrets - generate new ones based on config
    frameworkSecrets = {
      NODE_ENV: 'development',
      SECRETS_PROVIDER: 'local',
      LOG_LEVEL: 'debug',
    };

    // Step 1: Generate JWT keys and auth secrets (when useAuthTemplate=true)
    if (useAuthTemplate) {
      const { privateKey, publicKey, keyId } = generateRSAKeyPair();
      frameworkSecrets.JWT_PRIVATE_KEY_CURRENT = privateKey;
      frameworkSecrets.JWT_PUBLIC_KEY_CURRENT = publicKey;
      frameworkSecrets.JWT_KEY_ID_CURRENT = keyId;
      frameworkSecrets.REFRESH_TOKEN_SECRET = generateBase64Secret(32);
      frameworkSecrets.BCRYPT_ROUNDS = '12';
    }

    // Step 2: Generate KONG_TRUST_TOKEN (always)
    frameworkSecrets.KONG_TRUST_TOKEN = generateHexSecret(32);

    // Step 3: Generate service API keys (for all backend services)
    for (const service of config.services) {
      const isFrontend =
        (CLIENT_SIDE_FRONTEND_TYPES as readonly string[]).includes(
          service.type,
        ) || service.type === 'nextjs';
      if (!isFrontend) {
        const keyName = `${service.name.toUpperCase().replace(/-/g, '_')}_API_KEY`;
        frameworkSecrets[keyName] = generateHexSecret(32);
      }
    }
  }

  // Step 4: Generate service URLs for all backend services (local environment)
  const serviceUrlSecrets = generateServiceUrls(config, {}, 'local');

  const file: SecretsFile = {
    $comment: 'AUTO-GENERATED by tsdevstack - DO NOT EDIT',
    $warning:
      "This file is regenerated on every 'npx tsdevstack generate-secrets'",
    $regenerate: 'Safe to delete - will be recreated automatically',
    $generated_at: new Date().toISOString(),
    secrets: {
      ...frameworkSecrets,
      // Flattened REDIS secrets (no nesting)
      REDIS_HOST: LOCAL_REDIS_HOST,
      REDIS_PORT: LOCAL_REDIS_PORT,
      REDIS_PASSWORD: LOCAL_REDIS_PASSWORD,
      // TLS disabled for local dev (AWS ElastiCache requires 'true', GCP Memorystore uses 'false')
      REDIS_TLS: 'false',
      // Kong OIDC SSL verification - 'no' for local (no SSL to verify)
      KONG_SSL_VERIFY,
      // Kong gateway URL for Next.js server-side API calls
      KONG_INTERNAL_URL: KONG_GATEWAY_URL,
      // Service URLs for inter-service communication
      ...serviceUrlSecrets,
    },
  };

  // Step 5: Build lists for full mesh access (all backend services get all API keys and URLs)
  const allServiceApiKeys: string[] = [];
  const allServiceUrls: string[] = [];
  for (const service of config.services) {
    const isFrontend =
      (CLIENT_SIDE_FRONTEND_TYPES as readonly string[]).includes(
        service.type,
      ) || service.type === 'nextjs';
    if (!isFrontend) {
      const keyName = `${service.name.toUpperCase().replace(/-/g, '_')}_API_KEY`;
      allServiceApiKeys.push(keyName);

      const urlName = `${service.name.toUpperCase().replace(/-/g, '_')}_URL`;
      allServiceUrls.push(urlName);
    }
  }

  // Step 6: Generate and preserve database credentials
  const dbCredentials: Record<string, string> = {};
  let dbPortCounter = 5432;

  for (const service of config.services) {
    if (service.hasDatabase) {
      const dbPort = service.databasePort || dbPortCounter++;
      const prefix = service.name.replace(/-service$/, '');

      // Keys for database credentials in secrets object
      const usernameKey = `DB_${prefix.toUpperCase()}_USERNAME`;
      const passwordKey = `DB_${prefix.toUpperCase()}_PASSWORD`;

      // Preserve existing credentials or generate new ones
      const existingUsername = existingFrameworkSecrets?.secrets?.[
        usernameKey
      ] as string | undefined;
      const existingPassword = existingFrameworkSecrets?.secrets?.[
        passwordKey
      ] as string | undefined;

      const dbSecrets = generateDatabaseSecrets(
        service.name,
        dbPort,
        existingUsername,
        existingPassword,
      );

      // Store credentials in top-level secrets
      dbCredentials[usernameKey] = dbSecrets.username;
      dbCredentials[passwordKey] = dbSecrets.password;
    }
  }

  // Add database credentials to framework secrets
  file.secrets = {
    ...file.secrets,
    ...dbCredentials,
  };

  // Generate service-specific secrets (skip workers - they share secrets with base service)
  for (const service of config.services) {
    // Workers don't have ports and share secrets with their base service
    if (service.type === 'worker') {
      continue;
    }

    const isFrontend =
      (CLIENT_SIDE_FRONTEND_TYPES as readonly string[]).includes(
        service.type,
      ) || service.type === 'nextjs';

    let serviceSecretsArray: string[];

    if (isFrontend) {
      // Next.js services get KONG_INTERNAL_URL from framework (server-side API calls)
      // SPAs don't (they only call through public API_URL)
      if (service.type === 'nextjs') {
        serviceSecretsArray = ['KONG_INTERNAL_URL'];
      } else {
        serviceSecretsArray = [];
      }
    } else {
      // All backend services get: BACKEND_DEFAULT_SECRETS + KONG_TRUST_TOKEN + all service API keys + all service URLs
      serviceSecretsArray = [
        ...BACKEND_DEFAULT_SECRETS,
        'KONG_TRUST_TOKEN',
        ...allServiceApiKeys,
        ...allServiceUrls,
      ];

      // Auth-service additionally gets JWT keys (when useAuthTemplate=true)
      if (service.name === 'auth-service' && useAuthTemplate) {
        serviceSecretsArray.push(
          'JWT_PRIVATE_KEY_CURRENT',
          'JWT_PUBLIC_KEY_CURRENT',
          'JWT_KEY_ID_CURRENT',
          'BCRYPT_ROUNDS',
        );
      }

      // Add database credentials to service secrets array if service has a database
      if (service.hasDatabase) {
        const prefix = service.name.replace(/-service$/, '');
        serviceSecretsArray.push(
          `DB_${prefix.toUpperCase()}_USERNAME`,
          `DB_${prefix.toUpperCase()}_PASSWORD`,
        );
      }
    }

    // Non-worker services must have a port configured
    if (service.port === undefined) {
      throw new CliError(
        `Service "${service.name}" is missing required port configuration`,
        'generate-secrets',
        'Add "port" to the service entry in .tsdevstack/config.json',
      );
    }

    const serviceSecrets: Record<string, unknown> = {
      // PORT is stored as string for consistency with .env file format
      PORT: service.port.toString(),
      secrets: serviceSecretsArray,
    };

    // Add API_KEY alias for this service's own API key (for AuthGuard compatibility)
    if (!isFrontend) {
      const thisServiceApiKeyName = `${service.name.toUpperCase().replace(/-/g, '_')}_API_KEY`;
      serviceSecrets.API_KEY = frameworkSecrets[thisServiceApiKeyName];
    }

    // Generate DATABASE_URL if service has a database
    if (service.hasDatabase) {
      const dbPort =
        service.databasePort ||
        (service.hasDatabase
          ? 5432 + config.services.filter((s) => s.hasDatabase).indexOf(service)
          : 0);
      const prefix = service.name.replace(/-service$/, '');
      const usernameKey = `DB_${prefix.toUpperCase()}_USERNAME`;
      const passwordKey = `DB_${prefix.toUpperCase()}_PASSWORD`;

      const dbSecrets = generateDatabaseSecrets(
        service.name,
        dbPort,
        dbCredentials[usernameKey],
        dbCredentials[passwordKey],
      );

      serviceSecrets.DATABASE_URL = dbSecrets.url;
    }

    file[service.name] = serviceSecrets;
  }

  return file;
}
