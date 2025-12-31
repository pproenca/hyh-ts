// packages/daemon/src/ipc/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IPCServer } from './server.js';
import { IPCClient } from './client.js';
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

  it('should broadcast events to subscribed clients', async () => {
    server = new IPCServer(socketPath);
    await server.start();

    const client = new IPCClient(socketPath);
    await client.connect();

    const events: unknown[] = [];
    client.onEvent('trajectory', (event) => events.push(event));

    await client.request({ command: 'subscribe', channel: 'trajectory' });

    // Server broadcasts an event
    server.broadcast('trajectory', { type: 'tool_use', tool: 'Read' });

    // Wait briefly for event to arrive
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(events.length).toBeGreaterThan(0);
    expect(events[0]).toMatchObject({ type: 'tool_use' });

    client.disconnect();
  });
});

describe('IPCServer subscribe/unsubscribe', () => {
  let tempDir: string;
  let socketPath: string;
  let server: IPCServer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-ipc-'));
    socketPath = path.join(tempDir, 'test.sock');
    server = new IPCServer(socketPath);
    await server.start();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('handles subscribe request', async () => {
    const client = new IPCClient(socketPath);
    await client.connect();

    const result = await client.request({ command: 'subscribe', channel: 'state' });
    expect(result.status).toBe('ok');
    expect((result as { status: 'ok'; data: { subscribed: string } }).data.subscribed).toBe('state');

    client.disconnect();
  });

  it('removes subscription on client disconnect', async () => {
    const client = new IPCClient(socketPath);
    await client.connect();

    await client.request({ command: 'subscribe', channel: 'trajectory' });

    // Disconnect client
    client.disconnect();

    // Wait briefly for disconnect to process
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Broadcast should not error even though client disconnected
    expect(() => server.broadcast('trajectory', { test: true })).not.toThrow();
  });
});

describe('IPCServer multiple clients', () => {
  let tempDir: string;
  let socketPath: string;
  let server: IPCServer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-ipc-'));
    socketPath = path.join(tempDir, 'test.sock');
    server = new IPCServer(socketPath);
    server.registerHandler('ping', async () => ({ pong: true }));
    await server.start();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('handles multiple concurrent clients', async () => {
    const client1 = new IPCClient(socketPath);
    const client2 = new IPCClient(socketPath);

    await client1.connect();
    await client2.connect();

    const [result1, result2] = await Promise.all([
      client1.request({ command: 'ping' }),
      client2.request({ command: 'ping' }),
    ]);

    expect(result1.status).toBe('ok');
    expect(result2.status).toBe('ok');

    client1.disconnect();
    client2.disconnect();
  });

  it('broadcasts to multiple subscribers', async () => {
    const client1 = new IPCClient(socketPath);
    const client2 = new IPCClient(socketPath);

    await client1.connect();
    await client2.connect();

    const events1: unknown[] = [];
    const events2: unknown[] = [];

    client1.onEvent('updates', (e) => events1.push(e));
    client2.onEvent('updates', (e) => events2.push(e));

    await client1.request({ command: 'subscribe', channel: 'updates' });
    await client2.request({ command: 'subscribe', channel: 'updates' });

    server.broadcast('updates', { data: 'test' });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(events1.length).toBe(1);
    expect(events2.length).toBe(1);

    client1.disconnect();
    client2.disconnect();
  });
});

describe('IPCServer request validation', () => {
  let tempDir: string;
  let socketPath: string;
  let server: IPCServer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-ipc-'));
    socketPath = path.join(tempDir, 'test.sock');
    server = new IPCServer(socketPath);
    await server.start();
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('rejects malformed JSON', async () => {
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write('not valid json\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('error');

    client.end();
  });

  it('rejects requests missing command', async () => {
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({}) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('error');

    client.end();
  });
});

describe('IPCServer handler registration', () => {
  let tempDir: string;
  let socketPath: string;
  let server: IPCServer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-ipc-'));
    socketPath = path.join(tempDir, 'test.sock');
    server = new IPCServer(socketPath);
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('allows registering custom ping handler', async () => {
    server.registerHandler('ping', async () => ({
      pong: true,
      timestamp: Date.now(),
    }));
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'ping' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.pong).toBe(true);

    client.end();
  });

  it('allows registering get_state handler', async () => {
    server.registerHandler('get_state', async () => ({
      phase: 'implement',
      tasks: { pending: 5, completed: 3 },
    }));
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'get_state' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.phase).toBe('implement');

    client.end();
  });

  it('allows registering heartbeat handler with workerId', async () => {
    let receivedWorkerId: string | undefined;
    server.registerHandler('heartbeat', async (req: { workerId: string }) => {
      receivedWorkerId = req.workerId;
      return { acknowledged: true };
    });
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'heartbeat', workerId: 'worker-1' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(receivedWorkerId).toBe('worker-1');

    client.end();
  });

  it('allows registering task_claim handler', async () => {
    server.registerHandler('task_claim', async (req: { workerId: string }) => ({
      taskId: 'task-1',
      claimed: true,
      workerId: req.workerId,
    }));
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'task_claim', workerId: 'worker-1' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.claimed).toBe(true);

    client.end();
  });

  it('allows registering task_complete handler', async () => {
    server.registerHandler('task_complete', async (req: { taskId: string; workerId: string }) => ({
      success: true,
      taskId: req.taskId,
    }));
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'task_complete', taskId: 'task-1', workerId: 'worker-1' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.success).toBe(true);

    client.end();
  });

  it('allows registering exec handler', async () => {
    server.registerHandler('exec', async (req: { args: string[] }) => ({
      exitCode: 0,
      stdout: 'output',
      command: req.args.join(' '),
    }));
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'exec', args: ['npm', 'test'] }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.exitCode).toBe(0);

    client.end();
  });

  it('allows registering shutdown handler', async () => {
    let shutdownCalled = false;
    server.registerHandler('shutdown', async () => {
      shutdownCalled = true;
      return { shutting_down: true };
    });
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'shutdown' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(shutdownCalled).toBe(true);

    client.end();
  });

  it('allows registering status handler', async () => {
    server.registerHandler('status', async (req: { eventCount?: number }) => ({
      running: true,
      recentEvents: req.eventCount || 10,
    }));
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'status', eventCount: 5 }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.running).toBe(true);

    client.end();
  });
});
