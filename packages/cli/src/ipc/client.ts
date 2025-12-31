// packages/cli/src/ipc/client.ts
import * as net from 'node:net';
import type { IPCRequest, IPCResponse } from '@hyh/daemon';

export class IPCClient {
  private socket: net.Socket | null = null;
  private readonly socketPath: string;
  private buffer: string = '';
  private pendingResolve: ((response: IPCResponse) => void) | null = null;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath);

      this.socket.on('connect', () => resolve());
      this.socket.on('error', reject);

      this.socket.on('data', (data) => {
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.trim() && this.pendingResolve) {
            const response = JSON.parse(line) as IPCResponse;
            this.pendingResolve(response);
            this.pendingResolve = null;
          }
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  async request(req: IPCRequest): Promise<IPCResponse> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.socket!.write(JSON.stringify(req) + '\n');
    });
  }
}
