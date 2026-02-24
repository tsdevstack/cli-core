/**
 * Scaffold a stub auth-service-client package
 *
 * The frontend template depends on @shared/auth-service-client (workspace package).
 * This stub ensures npm install succeeds. The real client is generated later
 * by running `npx tsdevstack generate-client`.
 */

import * as fs from 'fs';
import { join } from 'path';
import { writeJsonFile } from '../fs';
import { logger } from '../logger';

export function scaffoldAuthServiceClient(projectDir: string): void {
  const clientDir = join(projectDir, 'packages', 'auth-service-client');
  const srcDir = join(clientDir, 'src');

  fs.mkdirSync(srcDir, { recursive: true });

  writeJsonFile(join(clientDir, 'package.json'), {
    name: '@shared/auth-service-client',
    version: '0.0.1',
    description:
      'Generated TypeScript client for auth-service API. Run `npx tsdevstack generate-client` to populate.',
    private: true,
    main: 'src/index.ts',
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
    },
  });

  fs.writeFileSync(
    join(srcDir, 'index.ts'),
    '// Stub — run `npx tsdevstack generate-client --service auth-service` to generate the real client\nexport {};\n',
  );

  writeJsonFile(join(clientDir, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2022',
      module: 'commonjs',
      declaration: true,
      outDir: './dist',
      rootDir: '.',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ['src'],
  });

  logger.success('auth-service-client stub created');
}
