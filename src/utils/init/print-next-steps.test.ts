import { describe, it, expect, rs, beforeEach } from '@rstest/core';

const { mockLogger } = rs.hoisted(() => ({
  mockLogger: {
    newline: rs.fn(),
    complete: rs.fn(),
    info: rs.fn(),
    warn: rs.fn(),
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
      };

      printNextSteps(options);

      expect(mockLogger.info).toHaveBeenCalledWith('  1. cd my-app');
    });

    it('should include add-service step for empty template', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
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
      };

      printNextSteps(options);

      const calls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(calls).not.toContainEqual(
        expect.stringContaining('npx tsdevstack add-service'),
      );
    });

    it('should include generic cloud:init step', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
      };

      printNextSteps(options);

      const calls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(calls).toContainEqual(
        expect.stringContaining('--gcp|--aws|--azure'),
      );
    });

    it('should include sync and npm run dev steps', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'auth',
        frontendName: null,
      };

      printNextSteps(options);

      const calls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(calls).toContainEqual(
        expect.stringContaining('npx tsdevstack sync'),
      );
      expect(calls).toContainEqual(expect.stringContaining('npm run dev'));
    });

    it('should show cloud:init as the last step', () => {
      const options: InitOptions = {
        projectName: 'my-app',
        template: 'auth',
        frontendName: null,
      };

      printNextSteps(options);

      const calls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      const cloudInitIndex = calls.findIndex((c: unknown) =>
        String(c).includes('cloud:init'),
      );
      const devIndex = calls.findIndex((c: unknown) =>
        String(c).includes('npm run dev'),
      );
      expect(cloudInitIndex).toBeGreaterThan(devIndex);
    });
  });

  describe('Failure summary', () => {
    const baseOptions: InitOptions = {
      projectName: 'my-app',
      template: 'auth',
      frontendName: null,
    };

    it('should not print success when failures are present', () => {
      printNextSteps(baseOptions, [{ name: 'npm install failed' }]);

      expect(mockLogger.complete).not.toHaveBeenCalled();
    });

    it('should print "created with issues" header when failures are present', () => {
      printNextSteps(baseOptions, [{ name: 'npm install failed' }]);

      const warnCalls = mockLogger.warn.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(warnCalls).toContainEqual(
        expect.stringContaining('created with issues'),
      );
    });

    it('should list each failure name', () => {
      printNextSteps(baseOptions, [
        { name: 'npm install failed' },
        { name: 'Sync failed' },
      ]);

      const warnCalls = mockLogger.warn.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(warnCalls).toContainEqual(
        expect.stringContaining('npm install failed'),
      );
      expect(warnCalls).toContainEqual(expect.stringContaining('Sync failed'));
    });

    it('should print the hint when provided', () => {
      printNextSteps(baseOptions, [
        { name: 'Sync failed', hint: 'cd my-app && npx tsdevstack sync' },
      ]);

      const infoCalls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(infoCalls).toContainEqual(
        expect.stringContaining('cd my-app && npx tsdevstack sync'),
      );
    });

    it('should print recovery instructions instead of next-steps list', () => {
      printNextSteps(baseOptions, [{ name: 'npm install failed' }]);

      const infoCalls = mockLogger.info.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(infoCalls).toContainEqual(expect.stringContaining('To recover'));
      expect(infoCalls).toContainEqual(
        expect.stringContaining('Resolve the issues above'),
      );
      expect(infoCalls).not.toContainEqual(
        expect.stringContaining('--gcp|--aws|--azure'),
      );
    });

    it('should fall back to success path when failures array is empty', () => {
      printNextSteps(baseOptions, []);

      expect(mockLogger.complete).toHaveBeenCalledWith(
        'Project "my-app" created successfully!',
      );
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });
});
