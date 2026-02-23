import { describe, it, expect, rs, beforeEach } from '@rstest/core';

rs.mock('inquirer', { mock: true });
rs.mock('../validation/validate-service-name', { mock: true });

import inquirer from 'inquirer';
import { validateServiceName } from '../validation/validate-service-name';
import { promptInitOptions } from './prompt-init-options';
import type { InitCliArgs } from './prompt-init-options';

describe('promptInitOptions', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  describe('All args provided', () => {
    it('should skip all prompts when all args are provided', async () => {
      const args: InitCliArgs = {
        name: 'my-app',
        template: 'empty',
        cloud: 'gcp',
      };

      const result = await promptInitOptions(args);

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(result).toEqual({
        projectName: 'my-app',
        template: 'empty',
        frontendName: null,
        cloudProvider: 'gcp',
      });
    });

    it('should validate provided project name', async () => {
      await promptInitOptions({
        name: 'my-app',
        template: 'empty',
        cloud: 'aws',
      });

      expect(validateServiceName).toHaveBeenCalledWith('my-app');
    });

    it('should prompt for frontend name when template is fullstack-auth', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({
        frontendName: 'web-app',
      });

      const result = await promptInitOptions({
        name: 'my-project',
        template: 'fullstack-auth',
        cloud: 'gcp',
      });

      expect(result.frontendName).toBe('web-app');
    });

    it('should use provided frontend name for fullstack-auth', async () => {
      const result = await promptInitOptions({
        name: 'my-project',
        template: 'fullstack-auth',
        frontendName: 'dashboard',
        cloud: 'gcp',
      });

      expect(inquirer.prompt).not.toHaveBeenCalled();
      expect(result.frontendName).toBe('dashboard');
      expect(validateServiceName).toHaveBeenCalledWith('dashboard');
    });
  });

  describe('Project name prompting', () => {
    it('should prompt for name when not provided', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({
        name: 'prompted-app',
      });

      const result = await promptInitOptions({
        template: 'empty',
        cloud: 'aws',
      });

      expect(result.projectName).toBe('prompted-app');
      const promptCall = rs.mocked(inquirer.prompt).mock
        .calls[0]?.[0] as unknown as Array<{ name: string; type: string }>;
      expect(promptCall[0]?.name).toBe('name');
      expect(promptCall[0]?.type).toBe('input');
    });
  });

  describe('Template prompting', () => {
    it('should prompt for template when not provided', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({
        template: 'auth',
      });

      const result = await promptInitOptions({
        name: 'my-app',
        cloud: 'gcp',
      });

      expect(result.template).toBe('auth');
    });

    it('should prompt for template when invalid value provided', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({
        template: 'empty',
      });

      const result = await promptInitOptions({
        name: 'my-app',
        template: 'invalid-template',
        cloud: 'gcp',
      });

      expect(result.template).toBe('empty');
      expect(inquirer.prompt).toHaveBeenCalledOnce();
    });
  });

  describe('Cloud provider prompting', () => {
    it('should prompt for cloud when not provided', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({ cloud: 'azure' });

      const result = await promptInitOptions({
        name: 'my-app',
        template: 'empty',
      });

      expect(result.cloudProvider).toBe('azure');
    });

    it('should set cloudProvider to null when user selects none', async () => {
      rs.mocked(inquirer.prompt).mockResolvedValueOnce({ cloud: 'none' });

      const result = await promptInitOptions({
        name: 'my-app',
        template: 'empty',
      });

      expect(result.cloudProvider).toBeNull();
    });

    it('should set cloudProvider to null when invalid cloud arg provided', async () => {
      const result = await promptInitOptions({
        name: 'my-app',
        template: 'empty',
        cloud: 'invalid-provider',
      });

      expect(result.cloudProvider).toBeNull();
    });
  });

  describe('Frontend name', () => {
    it('should not prompt for frontend name when template is empty', async () => {
      const result = await promptInitOptions({
        name: 'my-app',
        template: 'empty',
        cloud: 'gcp',
      });

      expect(result.frontendName).toBeNull();
    });

    it('should not prompt for frontend name when template is auth', async () => {
      const result = await promptInitOptions({
        name: 'my-app',
        template: 'auth',
        cloud: 'gcp',
      });

      expect(result.frontendName).toBeNull();
    });
  });
});
