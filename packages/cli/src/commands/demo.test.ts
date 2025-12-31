import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerDemoCommand } from './demo.js'; // tsx file

describe('hyh demo', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerDemoCommand(program);
    vi.clearAllMocks();
  });

  it('registers demo command', () => {
    const demoCommand = program.commands.find((cmd) => cmd.name() === 'demo');
    expect(demoCommand).toBeDefined();
  });

  it('has --create option', () => {
    const demoCommand = program.commands.find((cmd) => cmd.name() === 'demo');
    const createOption = demoCommand?.options.find((opt) => opt.long === '--create');
    expect(createOption).toBeDefined();
  });

  it('has --speed option', () => {
    const demoCommand = program.commands.find((cmd) => cmd.name() === 'demo');
    const speedOption = demoCommand?.options.find((opt) => opt.long === '--speed');
    expect(speedOption).toBeDefined();
  });
});
