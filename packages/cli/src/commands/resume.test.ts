// packages/cli/src/commands/resume.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerResumeCommand } from './resume.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

// Mock dependencies
vi.mock('../ipc/client.js');
vi.mock('../utils/socket.js');
vi.mock('node:fs/promises');

// Mock @hyh/daemon
vi.mock('@hyh/daemon', () => ({
  Daemon: vi.fn().mockImplementation(() => ({
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    loadWorkflow: vi.fn().mockResolvedValue(undefined),
    getSocketPath: vi.fn().mockReturnValue('/tmp/test.sock'),
  })),
  EventLoop: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

describe('hyh resume', () => {
  let program: Command;
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockConsoleError: ReturnType<typeof vi.spyOn>;
  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    program = new Command();
    registerResumeCommand(program);
    vi.clearAllMocks();

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockProcessExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
  });

  it('should register resume command', () => {
    const cmd = program.commands.find((c) => c.name() === 'resume');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Resume');
  });

  it('should accept --dir option', () => {
    const cmd = program.commands.find((c) => c.name() === 'resume');
    expect(cmd).toBeDefined();
    const dirOption = cmd?.options.find((opt) => opt.long === '--dir');
    expect(dirOption).toBeDefined();
  });

  describe('state validation', () => {
    it('exits with error if no state.json exists', async () => {
      const { findSocketPath } = await import('../utils/socket.js');
      vi.mocked(findSocketPath).mockResolvedValue(null);

      // Mock fs.access to fail for state.json
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await expect(program.parseAsync(['node', 'hyh', 'resume'])).rejects.toThrow(
        'process.exit called'
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        'No workflow state found. Start a workflow first with `hyh run`.'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it('exits with error if no workflow.json exists', async () => {
      const { findSocketPath } = await import('../utils/socket.js');
      vi.mocked(findSocketPath).mockResolvedValue(null);

      // state.json exists but workflow.json does not
      vi.mocked(fs.access).mockImplementation(async (filePath) => {
        const pathStr = filePath.toString();
        if (pathStr.includes('state.json')) {
          return undefined; // exists
        }
        throw new Error('ENOENT'); // workflow.json doesn't exist
      });

      await expect(program.parseAsync(['node', 'hyh', 'resume'])).rejects.toThrow(
        'process.exit called'
      );

      expect(mockConsoleError).toHaveBeenCalledWith(
        'No compiled workflow found. Run `hyh compile` first.'
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe('daemon detection', () => {
    it('connects to existing daemon if running', async () => {
      const { findSocketPath } = await import('../utils/socket.js');
      const { IPCClient } = await import('../ipc/client.js');

      // Both files exist
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // Socket exists (daemon running)
      vi.mocked(findSocketPath).mockResolvedValue('/tmp/existing.sock');

      // Mock IPC client
      const mockClient = {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        request: vi.fn().mockResolvedValue({
          status: 'ok',
          data: {
            state: {
              workflowName: 'test-workflow',
              currentPhase: 'implement',
            },
          },
        }),
      };
      vi.mocked(IPCClient).mockImplementation(() => mockClient as unknown as InstanceType<typeof IPCClient>);

      await program.parseAsync(['node', 'hyh', 'resume']);

      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.request).toHaveBeenCalledWith({ command: 'get_state' });
      expect(mockConsoleLog).toHaveBeenCalledWith('Connecting to running daemon...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Connected to workflow: test-workflow');
      expect(mockConsoleLog).toHaveBeenCalledWith('Current phase: implement');
      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('starts new daemon with existing state if not running', async () => {
      const { findSocketPath } = await import('../utils/socket.js');

      // Both files exist
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // No socket (daemon not running)
      vi.mocked(findSocketPath).mockResolvedValue(null);

      // Use a timeout to simulate daemon startup, but we need to handle the infinite await
      void program.parseAsync(['node', 'hyh', 'resume']);

      // Give the command time to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that daemon startup was initiated
      expect(mockConsoleLog).toHaveBeenCalledWith('Resuming workflow...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Workflow resumed successfully');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Socket:'));

      // We can't easily complete this test without killing the process,
      // but we've verified the key behavior
    });

    it('starts new daemon if existing daemon not responding', async () => {
      const { findSocketPath } = await import('../utils/socket.js');
      const { IPCClient } = await import('../ipc/client.js');

      // Both files exist
      vi.mocked(fs.access).mockResolvedValue(undefined);

      // Socket exists but daemon not responding
      vi.mocked(findSocketPath).mockResolvedValue('/tmp/stale.sock');

      // Mock IPC client that fails to connect
      const mockClient = {
        connect: vi.fn().mockRejectedValue(new Error('Connection refused')),
        disconnect: vi.fn().mockResolvedValue(undefined),
        request: vi.fn(),
      };
      vi.mocked(IPCClient).mockImplementation(() => mockClient as unknown as InstanceType<typeof IPCClient>);

      // Start parsing - will try to connect, fail, then start new daemon
      void program.parseAsync(['node', 'hyh', 'resume']);

      // Give the command time to process
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockConsoleLog).toHaveBeenCalledWith('Connecting to running daemon...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Daemon not responding, starting new instance...');
      expect(mockConsoleLog).toHaveBeenCalledWith('Resuming workflow...');
    });
  });

  describe('directory option', () => {
    it('uses current directory by default', async () => {
      const { findSocketPath } = await import('../utils/socket.js');
      vi.mocked(findSocketPath).mockResolvedValue(null);
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      try {
        await program.parseAsync(['node', 'hyh', 'resume']);
      } catch {
        // Expected to exit
      }

      // The state path should be in current directory
      expect(vi.mocked(fs.access)).toHaveBeenCalledWith(
        expect.stringContaining('.hyh')
      );
    });

    it('uses specified directory with --dir option', async () => {
      const { findSocketPath } = await import('../utils/socket.js');
      vi.mocked(findSocketPath).mockResolvedValue(null);
      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      try {
        await program.parseAsync(['node', 'hyh', 'resume', '--dir', '/custom/path']);
      } catch {
        // Expected to exit
      }

      // The state path should be in custom directory
      const statePath = path.join('/custom/path', '.hyh', 'state.json');
      expect(vi.mocked(fs.access)).toHaveBeenCalledWith(statePath);
    });
  });
});
