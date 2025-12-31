// packages/daemon/src/ipc/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IPCServer } from './server.js';
import * as net from 'node:net';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('IPCServer', () => {
  let tempDir: string;
  let socketPath: string;
  let server: IPCServer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-ipc-'));
    socketPath = path.join(tempDir, 'test.sock');
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('starts and accepts connections', async () => {
    server = new IPCServer(socketPath);
    server.registerHandler('ping', async () => ({ running: true, pid: process.pid }));

    await server.start();

    // Connect as client
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    // Send ping request
    client.write(JSON.stringify({ command: 'ping' }) + '\n');

    // Read response
    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.running).toBe(true);

    client.end();
  });

  it('handles unknown commands with error', async () => {
    server = new IPCServer(socketPath);
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'unknown' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('error');

    client.end();
  });
});
