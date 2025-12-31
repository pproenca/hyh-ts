// packages/cli/src/commands/task.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerTaskCommand } from './task.js';

describe('hyh task', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerTaskCommand(program);
    vi.clearAllMocks();
  });

  it('should register task command', () => {
    const cmd = program.commands.find((c) => c.name() === 'task');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Task management');
  });

  it('should have claim subcommand', () => {
    const taskCmd = program.commands.find((c) => c.name() === 'task');
    const claimCmd = taskCmd?.commands.find((c) => c.name() === 'claim');
    expect(claimCmd).toBeDefined();
    expect(claimCmd?.description()).toContain('Claim');
  });

  it('should have complete subcommand', () => {
    const taskCmd = program.commands.find((c) => c.name() === 'task');
    const completeCmd = taskCmd?.commands.find((c) => c.name() === 'complete');
    expect(completeCmd).toBeDefined();
    expect(completeCmd?.description()).toContain('complete');
  });

  it('should have reset subcommand', () => {
    const taskCmd = program.commands.find((c) => c.name() === 'task');
    const resetCmd = taskCmd?.commands.find((c) => c.name() === 'reset');
    expect(resetCmd).toBeDefined();
    expect(resetCmd?.description()).toContain('reset');
  });
});
