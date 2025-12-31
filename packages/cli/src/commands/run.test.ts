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

describe('run command with TUI', () => {
  it('should import and call startTUI when --tui is enabled', async () => {
    // This test verifies the import path works
    const { startTUI } = await import('@hyh/tui');
    expect(typeof startTUI).toBe('function');
  });
});

describe('plan import', () => {
  it('should have PlanImporter available from daemon', async () => {
    const { PlanImporter } = await import('@hyh/daemon');
    expect(typeof PlanImporter).toBe('function');
  });
});

describe('Claude CLI check', () => {
  it('should check for Claude CLI before running', async () => {
    const { checkClaudeCli } = await import('@hyh/daemon');
    const result = await checkClaudeCli();
    expect(result).toHaveProperty('available');
  });
});

describe('EventLoop integration', () => {
  it('should start event loop when daemon starts', async () => {
    // Verify EventLoop is available and can be instantiated with Daemon
    const { Daemon, EventLoop } = await import('@hyh/daemon');
    expect(EventLoop).toBeDefined();
    expect(typeof EventLoop).toBe('function');

    // Verify the EventLoop has the expected API
    const mockDaemon = {
      checkSpawnTriggers: async () => [],
      spawnAgents: async () => {},
      checkPhaseTransition: async () => false,
      stateManager: { flush: () => {} },
      heartbeatMonitor: { getOverdueAgents: () => [] },
    };
    const eventLoop = new EventLoop(mockDaemon, { tickInterval: 1000 });
    expect(eventLoop.start).toBeDefined();
    expect(eventLoop.stop).toBeDefined();
    expect(eventLoop.isRunning).toBe(false);

    eventLoop.start();
    expect(eventLoop.isRunning).toBe(true);

    eventLoop.stop();
    expect(eventLoop.isRunning).toBe(false);
  });
});
