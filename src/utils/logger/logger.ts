/**
 * Logger utility for consistent CLI output formatting
 */

export const logger = {
  /**
   * Standard info message (no icon)
   */
  info: (message: string): void => {
    console.log(message);
  },

  /**
   * Success message (✅)
   */
  success: (message: string): void => {
    console.log(`✅ ${message}`);
  },

  /**
   * Error message (❌)
   */
  error: (message: string): void => {
    console.error(`❌ ${message}`);
  },

  /**
   * Warning message (⚠️)
   */
  warn: (message: string): void => {
    console.warn(`⚠️  ${message}`);
  },

  /**
   * Debug message (🐛)
   * For stack traces and detailed error information
   */
  debug: (message: string): void => {
    console.error(`🐛 ${message}`);
  },

  /**
   * Empty line
   */
  newline: (): void => {
    console.log('');
  },

  // Semantic action methods with predefined icons

  /**
   * Generating action (⚙️)
   */
  generating: (message: string): void => {
    console.log(`⚙️  ${message}`);
  },

  /**
   * Reading action (📖)
   */
  reading: (message: string): void => {
    console.log(`📖 ${message}`);
  },

  /**
   * Loading action (📋)
   */
  loading: (message: string): void => {
    console.log(`📋 ${message}`);
  },

  /**
   * Checking action (🔍)
   */
  checking: (message: string): void => {
    console.log(`🔍 ${message}`);
  },

  /**
   * Running action (📦)
   */
  running: (message: string): void => {
    console.log(`📦 ${message}`);
  },

  /**
   * Creating action (📝)
   */
  creating: (message: string): void => {
    console.log(`📝 ${message}`);
  },

  /**
   * Updating action (🔄)
   */
  updating: (message: string): void => {
    console.log(`🔄 ${message}`);
  },

  /**
   * Syncing action (🔄)
   */
  syncing: (message: string): void => {
    console.log(`🔄 ${message}`);
  },

  /**
   * Validating action (✓)
   */
  validating: (message: string): void => {
    console.log(`✓ ${message}`);
  },

  /**
   * Building action (🔨)
   */
  building: (message: string): void => {
    console.log(`🔨 ${message}`);
  },

  /**
   * Complete/Done action (🎉)
   */
  complete: (message: string): void => {
    console.log(`🎉 ${message}`);
  },

  /**
   * Summary section (📋)
   */
  summary: (message: string): void => {
    console.log(`📋 ${message}`);
  },

  /**
   * Ready/Launch message (🚀)
   */
  ready: (message: string): void => {
    console.log(`🚀 ${message}`);
  },
};
