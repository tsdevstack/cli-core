import { describe, it, expect, rs, beforeEach } from '@rstest/core';
import { logger } from './logger';

describe('logger', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rs.spyOn(console, 'log').mockImplementation(() => {});
    rs.spyOn(console, 'error').mockImplementation(() => {});
    rs.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('Basic methods', () => {
    it('should log info message without icon', () => {
      logger.info('test message');
      expect(console.log).toHaveBeenCalledWith('test message');
    });

    it('should log success with checkmark icon', () => {
      logger.success('done');
      expect(console.log).toHaveBeenCalledWith('✅ done');
    });

    it('should log error with x icon to stderr', () => {
      logger.error('failed');
      expect(console.error).toHaveBeenCalledWith('❌ failed');
    });

    it('should log warning with warning icon to stderr', () => {
      logger.warn('caution');
      expect(console.warn).toHaveBeenCalledWith('⚠️  caution');
    });

    it('should log debug with bug icon to stderr', () => {
      logger.debug('debug info');
      expect(console.error).toHaveBeenCalledWith('🐛 debug info');
    });

    it('should log empty line', () => {
      logger.newline();
      expect(console.log).toHaveBeenCalledWith('');
    });
  });

  describe('Semantic action methods', () => {
    it('should log generating with gear icon', () => {
      logger.generating('config');
      expect(console.log).toHaveBeenCalledWith('⚙️  config');
    });

    it('should log reading with book icon', () => {
      logger.reading('file');
      expect(console.log).toHaveBeenCalledWith('📖 file');
    });

    it('should log loading with clipboard icon', () => {
      logger.loading('data');
      expect(console.log).toHaveBeenCalledWith('📋 data');
    });

    it('should log checking with magnifier icon', () => {
      logger.checking('status');
      expect(console.log).toHaveBeenCalledWith('🔍 status');
    });

    it('should log running with package icon', () => {
      logger.running('command');
      expect(console.log).toHaveBeenCalledWith('📦 command');
    });

    it('should log creating with pencil icon', () => {
      logger.creating('file');
      expect(console.log).toHaveBeenCalledWith('📝 file');
    });

    it('should log updating with refresh icon', () => {
      logger.updating('config');
      expect(console.log).toHaveBeenCalledWith('🔄 config');
    });

    it('should log syncing with refresh icon', () => {
      logger.syncing('data');
      expect(console.log).toHaveBeenCalledWith('🔄 data');
    });

    it('should log validating with checkmark', () => {
      logger.validating('schema');
      expect(console.log).toHaveBeenCalledWith('✓ schema');
    });

    it('should log building with hammer icon', () => {
      logger.building('project');
      expect(console.log).toHaveBeenCalledWith('🔨 project');
    });

    it('should log complete with party icon', () => {
      logger.complete('all done');
      expect(console.log).toHaveBeenCalledWith('🎉 all done');
    });

    it('should log summary with clipboard icon', () => {
      logger.summary('results');
      expect(console.log).toHaveBeenCalledWith('📋 results');
    });

    it('should log ready with rocket icon', () => {
      logger.ready('launch');
      expect(console.log).toHaveBeenCalledWith('🚀 launch');
    });
  });
});
