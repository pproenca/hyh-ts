// packages/cli/src/commands/dev.test.ts
import { describe, it, expect } from 'vitest';
import { registerDevCommand } from './dev.js';
import { Command } from 'commander';

describe('hyh dev command', () => {
  it('should register dev command with watch option', () => {
    const program = new Command();
    registerDevCommand(program);

    const devCmd = program.commands.find((c) => c.name() === 'dev');
    expect(devCmd).toBeDefined();
    expect(devCmd?.options.some((o) => o.long === '--no-tui')).toBe(true);
  });
});
