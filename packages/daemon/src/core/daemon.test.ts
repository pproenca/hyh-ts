// packages/daemon/src/core/daemon.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Daemon } from './daemon.js';
import { CheckerChain } from '../checkers/chain.js';
import { TddChecker } from '../checkers/tdd.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';

describe('Daemon', () => {
  let tempDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-daemon-'));
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('starts and responds to ping', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    // Connect and send ping
    const socketPath = daemon.getSocketPath();
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'ping' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.running).toBe(true);

    client.end();
  });

  it('handles get_state when no workflow exists', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    const socketPath = daemon.getSocketPath();
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'get_state' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.state).toBeNull();

    client.end();
  });

  it('handles heartbeat request', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    const socketPath = daemon.getSocketPath();
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    const workerId = 'test-worker-123';
    client.write(JSON.stringify({ command: 'heartbeat', workerId }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.ok).toBe(true);
    expect(typeof parsed.data.timestamp).toBe('number');

    client.end();
  });

  it('should check invariants when processing agent events', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });

    // Create a CheckerChain with TDD checker that requires test before impl
    const checkerChain = new CheckerChain([
      new TddChecker({
        test: '**/*.test.ts',
        impl: 'src/**/*.ts',
        agentName: 'worker',
      }),
    ]);
    daemon.loadCheckerChain(checkerChain);

    await daemon.start();

    // Simulate agent event that violates TDD (impl before test)
    const result = await daemon.processAgentEvent('worker-1', {
      type: 'tool_use',
      tool: 'Write',
      path: 'src/feature.ts',
      timestamp: Date.now(),
      agentId: 'worker-1',
    });

    expect(result.violation).toBeDefined();
    expect(result.violation?.type).toBe('tdd');

    await daemon.stop();
  });
});
