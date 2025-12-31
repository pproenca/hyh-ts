// packages/cli/src/commands/run.test.ts
import { describe, it, expect } from 'vitest';

describe('run command', () => {
  it('exports registerRunCommand', async () => {
    const { registerRunCommand } = await import('./run.js');
    expect(registerRunCommand).toBeDefined();
  });
});
