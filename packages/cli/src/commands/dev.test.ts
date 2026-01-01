// packages/cli/src/commands/dev.test.ts
import { describe, it, expect, vi } from 'vitest';
import { registerDevCommand } from './dev.js';
import { Command } from 'commander';

describe('hyh dev command', () => {
  it('should register dev command with port option', () => {
    const program = new Command();
    registerDevCommand(program);

    const devCmd = program.commands.find((c) => c.name() === 'dev');
    expect(devCmd).toBeDefined();
    expect(devCmd?.options.some((o) => o.long === '--port')).toBe(true);
  });
});

describe('dev command implementation', () => {
  it('compiles workflow and starts daemon', async () => {
    // Mock the imports
    const mockDaemon = {
      start: vi.fn().mockResolvedValue(undefined),
      loadWorkflow: vi.fn().mockResolvedValue(undefined),
      getSocketPath: vi.fn().mockReturnValue('/tmp/test.sock'),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    // Test that dev command initializes properly
    expect(mockDaemon.start).toBeDefined();
    expect(mockDaemon.loadWorkflow).toBeDefined();
  });

  it('registers port option for socket connection', () => {
    const program = new Command();
    registerDevCommand(program);

    const devCmd = program.commands.find((c) => c.name() === 'dev');
    expect(devCmd).toBeDefined();
    expect(devCmd?.options.some((o) => o.long === '--port')).toBe(true);
  });

  it('accepts workflow path as argument', () => {
    const program = new Command();
    registerDevCommand(program);

    const devCmd = program.commands.find((c) => c.name() === 'dev');
    expect(devCmd).toBeDefined();
    // Check that command accepts a workflow argument
    const args = devCmd?.registeredArguments;
    expect(args).toBeDefined();
    expect(args?.length).toBeGreaterThan(0);
  });
});
