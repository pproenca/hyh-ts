// packages/daemon/src/ipc/server.ts
import * as net from 'node:net';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { IPCRequestSchema, IPCResponse } from '../types/ipc.js';

type RequestHandler = (request: unknown, socket: net.Socket) => Promise<unknown>;

export class IPCServer extends EventEmitter {
  private readonly socketPath: string;
  private server: net.Server | null = null;
  private clients: Set<net.Socket> = new Set();
  private handlers: Map<string, RequestHandler> = new Map();
  private subscriptions: Map<string, Set<net.Socket>> = new Map();

  constructor(socketPath: string) {
    super();
    this.socketPath = socketPath;

    // Register built-in subscribe handler
    this.registerHandler(
      'subscribe',
      async (request: unknown, socket: net.Socket) => {
        const { channel } = request as { channel: string };
        if (!this.subscriptions.has(channel)) {
          this.subscriptions.set(channel, new Set());
        }
        this.subscriptions.get(channel)!.add(socket);

        // Clean up subscription on disconnect
        socket.once('close', () => {
          this.subscriptions.get(channel)?.delete(socket);
        });

        return { subscribed: channel };
      }
    );
  }

  registerHandler(command: string, handler: RequestHandler): void {
    this.handlers.set(command, handler);
  }

  async start(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.socketPath), { recursive: true });

    // Remove stale socket
    try {
      await fs.unlink(this.socketPath);
    } catch {
      // Ignore if doesn't exist
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', reject);

      this.server.listen(this.socketPath, () => {
        // Set socket permissions (read/write for owner only)
        fs.chmod(this.socketPath, 0o600).catch(() => {});
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // Close all client connections
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();

    // Close server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          // Clean up socket file
          fs.unlink(this.socketPath).catch(() => {});
          resolve();
        });
      });
    }
  }

  broadcast(channel: string, data: unknown): void {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers) return;

    const message = JSON.stringify({ type: 'event', event: channel, data }) + '\n';
    for (const socket of subscribers) {
      socket.write(message);
    }
  }

  private handleConnection(socket: net.Socket): void {
    this.clients.add(socket);

    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // Process complete messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line

      for (const line of lines) {
        if (line.trim()) {
          const response = await this.dispatch(line, socket);
          socket.write(JSON.stringify(response) + '\n');
        }
      }
    });

    socket.on('close', () => {
      this.clients.delete(socket);
    });

    socket.on('error', (error) => {
      this.emit('error', error);
      this.clients.delete(socket);
    });
  }

  private async dispatch(
    raw: string,
    socket: net.Socket
  ): Promise<IPCResponse> {
    try {
      const data = JSON.parse(raw);
      const parseResult = IPCRequestSchema.safeParse(data);

      if (!parseResult.success) {
        return {
          status: 'error',
          message: `Invalid request: ${parseResult.error.message}`,
        };
      }

      const request = parseResult.data;
      const handler = this.handlers.get(request.command);

      if (!handler) {
        return {
          status: 'error',
          message: `Unknown command: ${request.command}`,
        };
      }

      const result = await handler(request, socket);
      return {
        status: 'ok',
        data: result,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
