import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockLogger } = rs.hoisted(() => ({
  mockLogger: {
    newline: rs.fn(),
    complete: rs.fn(),
    info: rs.fn(),
  },
}));

rs.mock('../logger', () => ({
  logger: mockLogger,
}));

import { printNextSteps } from './print-next-steps';
import type { InitOptions } from './prompt-init-options';

describe('printNextSteps', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('Standard use cases', () => {
    it('should print success message with project name', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
        cloudProvider: null,
      };

      printNextSteps(options);

      expect(mockLogger.complete).toHaveBeenCalledWith(
        'Project "my-app" created successfully!',
      );
    });

    it('should include cd command as step 1', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
        cloudProvider: null,
      };

      printNextSteps(options);

      expect(mockLogger.info).toHaveBeenCalledWith('  1. cd my-app');
    });

    it('should include add-service step for empty template', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
        cloudProvider: null,
      };

      printNextSteps(options);

      const calls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(calls).toContainEqual(
        expect.stringContaining('npx tsdevstack add-service'),
      );
    });

    it('should not include add-service step for auth template', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'auth',
        frontendName: null,
        cloudProvider: null,
      };

      printNextSteps(options);

      const calls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(calls).not.toContainEqual(
        expect.stringContaining('npx tsdevstack add-service'),
      );
    });

    it('should include specific cloud:init step when provider is chosen', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
        cloudProvider: 'aws',
      };

      printNextSteps(options);

      const calls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(calls).toContainEqual(expect.stringContaining('cloud:init --aws'));
    });

    it('should include generic cloud:init step when no provider is chosen', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
        cloudProvider: null,
      };

      printNextSteps(options);

      const calls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(calls).toContainEqual(
        expect.stringContaining('--gcp|--aws|--azure'),
      );
    });

    it('should include docker compose and npm run dev steps', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'auth',
        frontendName: null,
        cloudProvider: null,
      };

      printNextSteps(options);

      const calls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(calls).toContainEqual(
        expect.stringContaining('docker compose up -d'),
      );
      expect(calls).toContainEqual(expect.stringContaining('npm run dev'));
    });
  });
});
