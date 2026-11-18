import { describe, it, expect } from '@rstest/core';
import { buildAccountSuffix } from './build-account-suffix';

describe('buildAccountSuffix', () => {
  describe('Standard use cases', () => {
    // Same values as infra-core's buildAccountSuffix test: both must agree
    it('should give six lowercase hex characters of the ID', () => {
      expect(buildAccountSuffix('my-gcp-project')).toBe('ffe340');
      expect(buildAccountSuffix('00000000-0000-0000-0000-000000000000')).toBe(
        '12b937',
      );
    });
  });
});
