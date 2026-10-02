/**
 * Generate the .dockerignore of a Kong build context
 */

import {
  KONG_DECLARATIVE_DIR,
  KONG_GENERATED_FILE_HEADER,
  KONG_PLUGINS_DIR,
} from '../../constants';

/**
 * Returns the .dockerignore content: only the Dockerfile, the staged plugins
 * and the declarative config directory are sent to the Docker build.
 */
export function generateKongDockerignore(): string {
  return `${KONG_GENERATED_FILE_HEADER}
# Only the files the Kong image needs are sent to the Docker build.
*
!Dockerfile
!${KONG_PLUGINS_DIR}/
!${KONG_DECLARATIVE_DIR}/
`;
}
