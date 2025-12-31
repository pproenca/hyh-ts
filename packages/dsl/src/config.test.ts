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

describe('HyhConfig daemon settings', () => {
  it('accepts socketPath option', () => {
    const config = defineConfig({
      daemon: { socketPath: '/custom/socket.sock' },
    });
    expect(config.daemon?.socketPath).toBe('/custom/socket.sock');
  });

  it('accepts stateDir option', () => {
    const config = defineConfig({
      daemon: { stateDir: '/custom/state' },
    });
    expect(config.daemon?.stateDir).toBe('/custom/state');
  });

  it('accepts logLevel option', () => {
    const config = defineConfig({
      daemon: { logLevel: 'debug' },
    });
    expect(config.daemon?.logLevel).toBe('debug');
  });
});

describe('HyhConfig claude settings', () => {
  it('accepts defaultModel option', () => {
    const config = defineConfig({
      claude: { defaultModel: 'opus' },
    });
    expect(config.claude?.defaultModel).toBe('opus');
  });

  it('accepts maxTokens option', () => {
    const config = defineConfig({
      claude: { maxTokens: 8192 },
    });
    expect(config.claude?.maxTokens).toBe(8192);
  });

  it('accepts timeout option', () => {
    const config = defineConfig({
      claude: { timeout: '10m' },
    });
    expect(config.claude?.timeout).toBe('10m');
  });
});

describe('HyhConfig git settings', () => {
  it('accepts mainBranch option', () => {
    const config = defineConfig({
      git: { mainBranch: 'master' },
    });
    expect(config.git?.mainBranch).toBe('master');
  });

  it('accepts worktreeDir option', () => {
    const config = defineConfig({
      git: { worktreeDir: '/tmp/worktrees' },
    });
    expect(config.git?.worktreeDir).toBe('/tmp/worktrees');
  });

  it('accepts autoCommit option', () => {
    const config = defineConfig({
      git: { autoCommit: true },
    });
    expect(config.git?.autoCommit).toBe(true);
  });
});
