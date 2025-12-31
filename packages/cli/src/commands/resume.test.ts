// packages/cli/src/commands/resume.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerResumeCommand } from './resume.js';

describe('hyh resume', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerResumeCommand(program);
    vi.clearAllMocks();
  });

  it('should register resume command', () => {
    const cmd = program.commands.find((c) => c.name() === 'resume');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Resume');
  });
});
