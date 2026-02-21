import { describe, it, expect } from '@rstest/core';
import { extractAuthor } from './extract-author';
import type { PackageJson } from './package-json-types';

describe('extractAuthor', () => {
  describe('when author is a string', () => {
    it('should return the author string', () => {
      const packageJson: PackageJson = {
        name: 'test',
        author: 'John Doe',
      };

      expect(extractAuthor(packageJson)).toBe('John Doe');
    });

    it('should return email format author', () => {
      const packageJson: PackageJson = {
        name: 'test',
        author: 'John Doe <john@example.com>',
      };

      expect(extractAuthor(packageJson)).toBe('John Doe <john@example.com>');
    });
  });

  describe('when author is an object', () => {
    it('should return the name property', () => {
      const packageJson: PackageJson = {
        name: 'test',
        author: { name: 'Jane Doe' },
      };

      expect(extractAuthor(packageJson)).toBe('Jane Doe');
    });

    it('should return unknown when name property is empty', () => {
      const packageJson: PackageJson = {
        name: 'test',
        author: { name: '' },
      };

      expect(extractAuthor(packageJson)).toBe('unknown');
    });
  });

  describe('when author is missing', () => {
    it('should return unknown when author is undefined', () => {
      const packageJson: PackageJson = {
        name: 'test',
      };

      expect(extractAuthor(packageJson)).toBe('unknown');
    });

    it('should return unknown when author is null-like', () => {
      const packageJson: PackageJson = {
        name: 'test',
        author: undefined,
      };

      expect(extractAuthor(packageJson)).toBe('unknown');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string author', () => {
      const packageJson: PackageJson = {
        name: 'test',
        author: '',
      };

      // Empty string is falsy, so returns 'unknown'
      expect(extractAuthor(packageJson)).toBe('unknown');
    });

    it('should handle whitespace-only author', () => {
      const packageJson: PackageJson = {
        name: 'test',
        author: '   ',
      };

      // Whitespace is truthy, returned as-is
      expect(extractAuthor(packageJson)).toBe('   ');
    });
  });
});
