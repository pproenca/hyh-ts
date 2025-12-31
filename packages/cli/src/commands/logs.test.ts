// packages/cli/src/commands/logs.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { registerLogsCommand } from './logs.js';

vi.mock('../ipc/client.js');
vi.mock('../utils/socket.js');

describe('hyh logs', () => {
  it('should register logs command', () => {
    const program = new Command();
    registerLogsCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'logs');
    expect(cmd).toBeDefined();
  });
});
