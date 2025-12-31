// packages/cli/src/ipc/client.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IPCClient } from './client.js';
import { Daemon } from '@hyh/daemon';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

describe('IPCClient', () => {
  let daemon: Daemon;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-ipc-test-'));
    daemon = new Daemon({ worktreeRoot: tmpDir });
    await daemon.start();
  });

  afterAll(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true });
  });

  it('connects and sends ping request', async () => {
    const client = new IPCClient(daemon.getSocketPath());
    await client.connect();

    const response = await client.request({ command: 'ping' });

    expect(response.status).toBe('ok');
    if (response.status === 'ok') {
      expect(response.data).toEqual({ running: true, pid: process.pid });
    }

    await client.disconnect();
  });
});
