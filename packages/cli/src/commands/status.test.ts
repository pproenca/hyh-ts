// packages/cli/src/commands/status.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { registerStatusCommand } from './status.js';

vi.mock('../ipc/client.js');
vi.mock('../utils/socket.js');

describe('hyh status', () => {
  it('should register status command', () => {
    const program = new Command();
    registerStatusCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'status');
    expect(cmd).toBeDefined();
  });

  it('should accept --quiet flag', () => {
    const program = new Command();
    registerStatusCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'status');
    expect(cmd).toBeDefined();

    // Verify --quiet option was registered
    const quietOption = cmd?.options.find((opt) => opt.long === '--quiet');
    expect(quietOption).toBeDefined();
  });
});
