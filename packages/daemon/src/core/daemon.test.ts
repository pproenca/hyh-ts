// packages/daemon/src/core/daemon.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Daemon } from './daemon.js';
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
});
