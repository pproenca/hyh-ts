// packages/daemon/src/agents/claude-cli.test.ts
import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

// Check for Claude CLI availability at module load time (before test collection)
function isClaudeAvailable(): boolean {
  try {
    execSync('claude --version', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const claudeAvailable = isClaudeAvailable();

describe('checkClaudeCli function', () => {
  it('should export checkClaudeCli function', async () => {
    const { checkClaudeCli } = await import('./claude-cli.js');
    expect(typeof checkClaudeCli).toBe('function');
  });
});

describe('Claude CLI integration', () => {
  it.skipIf(!claudeAvailable)('should have claude CLI available', () => {
    const version = execSync('claude --version', { encoding: 'utf-8' });
    expect(version).toMatch(/\d+\.\d+/);
  });

  it.skipIf(!claudeAvailable)('should accept --output-format stream-json flag', () => {
    // Just check the flag is accepted (with --help to avoid actual execution)
    const help = execSync('claude --help', { encoding: 'utf-8' });
    expect(help).toContain('output-format');
  });

  it.skipIf(!claudeAvailable)('should accept --session-id flag', () => {
    const help = execSync('claude --help', { encoding: 'utf-8' });
    expect(help).toContain('session');
  });
});
