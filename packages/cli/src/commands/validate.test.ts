// packages/cli/src/commands/validate.test.ts
import { describe, it, expect } from 'vitest';

describe('validate command', () => {
  it('exports registerValidateCommand', async () => {
    const { registerValidateCommand } = await import('./validate.js');
    expect(registerValidateCommand).toBeDefined();
  });
});
