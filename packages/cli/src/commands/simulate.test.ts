// packages/cli/src/commands/simulate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerSimulateCommand } from './simulate.js';

describe('hyh simulate', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerSimulateCommand(program);
    vi.clearAllMocks();
  });

  it('should register simulate command', () => {
    const cmd = program.commands.find((c) => c.name() === 'simulate');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('simulation');
  });

  it('should accept workflow file argument', () => {
    const cmd = program.commands.find((c) => c.name() === 'simulate');
    expect(cmd?.args).toBeDefined();
  });

  it('should accept --speed option', () => {
    const cmd = program.commands.find((c) => c.name() === 'simulate');
    const speedOpt = cmd?.options.find((o) => o.long === '--speed');
    expect(speedOpt).toBeDefined();
  });

  it('should accept --seed option', () => {
    const cmd = program.commands.find((c) => c.name() === 'simulate');
    const seedOpt = cmd?.options.find((o) => o.long === '--seed');
    expect(seedOpt).toBeDefined();
  });
});
