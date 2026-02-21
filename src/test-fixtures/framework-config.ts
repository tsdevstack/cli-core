/**
 * Test fixtures for FrameworkConfig
 * Reusable mock configurations for tests
 */

import type { FrameworkConfig } from '../utils/config/types';

export const createMockFrameworkConfig = (
  overrides?: Partial<FrameworkConfig>
): FrameworkConfig => ({
  project: {
    name: 'test-project',
    version: '1.0.0',
  },
  cloud: { provider: null },
  services: [],
  ...overrides,
});
