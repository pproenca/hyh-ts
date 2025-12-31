// packages/cli/src/commands/run.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerRunCommand } from './run.js';

describe('run command', () => {
  it('exports registerRunCommand', async () => {
    const { registerRunCommand } = await import('./run.js');
    expect(registerRunCommand).toBeDefined();
  });
});

describe('hyh run config loading', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerRunCommand(program);
  });

  it('should accept --config option', () => {
    const cmd = program.commands.find((c) => c.name() === 'run');
    const configOpt = cmd?.options.find((o) => o.long === '--config');
    expect(configOpt).toBeDefined();
  });
});
