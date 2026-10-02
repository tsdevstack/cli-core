import { describe, it, expect } from '@rstest/core';
import { generateKongDockerignore } from './generate-kong-dockerignore';

describe('generateKongDockerignore', () => {
  it('should exclude everything by default', () => {
    expect(generateKongDockerignore()).toMatch(/^\*$/m);
  });

  it('should include only the Dockerfile, kong-plugins/ and declarative/', () => {
    const includes = generateKongDockerignore()
      .split('\n')
      .filter((line) => line.startsWith('!'));
    expect(includes).toEqual([
      '!Dockerfile',
      '!kong-plugins/',
      '!declarative/',
    ]);
  });
});
