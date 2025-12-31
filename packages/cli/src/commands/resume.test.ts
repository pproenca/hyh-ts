// packages/cli/src/commands/resume.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerResumeCommand } from './resume.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

vi.mock('node:fs/promises');
vi.mock('./run.js', () => ({
  startWorkflow: vi.fn(),
}));

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
