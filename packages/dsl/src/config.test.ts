import { describe, it, expect } from 'vitest';
import { defineConfig, type HyhConfig } from './config.js';

describe('defineConfig', () => {
  it('should return the config unchanged', () => {
    const config: HyhConfig = {
      daemon: { logLevel: 'debug' },
      claude: { defaultModel: 'sonnet' },
    };
    const result = defineConfig(config);
    expect(result).toEqual(config);
  });

  it('should accept empty config', () => {
    const result = defineConfig({});
    expect(result).toEqual({});
  });

  it('should type-check all config sections', () => {
    const config: HyhConfig = {
      daemon: { socketPath: '/tmp/test.sock', logLevel: 'warn' },
      claude: { defaultModel: 'opus', maxTokens: 4096, timeout: '5m' },
      git: { mainBranch: 'main', autoCommit: false },
    };
    expect(defineConfig(config).daemon?.socketPath).toBe('/tmp/test.sock');
  });
});
