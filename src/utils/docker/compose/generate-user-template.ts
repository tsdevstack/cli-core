/**
 * Generate docker-compose.user.yml template if it doesn't exist
 */

import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../../logger';
import { isFile } from '../../fs';

export function generateUserComposeTemplate(
  rootDir: string,
  networkName: string,
): void {
  const userComposePath = path.join(rootDir, 'docker-compose.user.yml');

  // Don't overwrite if it already exists
  if (isFile(userComposePath)) {
    logger.info(
      '   ℹ️  docker-compose.user.yml already exists (preserving user services)',
    );
    return;
  }

  const templateContent = `# docker-compose.user.yml
#
# ⚠️  SECURITY WARNING: This file is committed to git - NEVER add secrets here!
#
# Add your custom development services here.
# For secrets, reference them from .env using \${VARIABLE_NAME} syntax.
#
# Framework services: Kong (8000-8001), Redis (6379), Databases (5432+),
#                     pgAdmin (5050), Redis Commander (8081)
#
# Example services (uncomment to use):

# services:
#   mailhog:
#     image: mailhog/mailhog
#     ports:
#       - "1025:1025"
#       - "8025:8025"
#     networks:
#       - ${networkName}
#
#   rustfs:
#     image: rustfs/rustfs:1.0.3
#     environment:
#       # ⚠️ For production secrets, add to .secrets.user.json and reference here:
#       RUSTFS_ACCESS_KEY: \${RUSTFS_USER}
#       RUSTFS_SECRET_KEY: \${RUSTFS_PASSWORD}
#     ports:
#       - "9000:9000"
#       - "9001:9001"
#     volumes:
#       - ./data/rustfs:/data
#     networks:
#       - ${networkName}
`;

  fs.writeFileSync(userComposePath, templateContent, 'utf-8');
  logger.success('Generated docker-compose.user.yml template');
}
