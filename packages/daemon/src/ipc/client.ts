// packages/daemon/src/ipc/client.ts
import * as net from 'node:net';
import type { IPCRequest, IPCResponse } from '../types/ipc.js';

export type EventCallback = (event: unknown) => void;

export interface IPCClientOptions {
  requestTimeout?: number; // Default: 30000ms (30 seconds)
}

export class IPCClient {
  private socket: net.Socket | null = null;
  private readonly socketPath: string;
  private readonly requestTimeout: number;
  private buffer: string = '';
  private pendingResolve: ((response: IPCResponse) => void) | null = null;
  private pendingReject: ((error: Error) => void) | null = null;
  private requestTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<EventCallback>> = new Map();

  constructor(socketPath: string, options: IPCClientOptions = {}) {
    this.socketPath = socketPath;
    this.requestTimeout = options.requestTimeout ?? 30000;
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
          if (line.trim()) {
            const message = JSON.parse(line) as IPCResponse | { type: 'event'; event: string; data: unknown };

            // Check if it's an event notification
            if ('type' in message && message.type === 'event') {
              this.emitEvent(message.event, message.data);
            } else if (this.pendingResolve) {
              // It's a response to a request - clear timeout and resolve
              if (this.requestTimer) {
                clearTimeout(this.requestTimer);
                this.requestTimer = null;
              }
              this.pendingResolve(message as IPCResponse);
              this.pendingResolve = null;
              this.pendingReject = null;
            }
          }
        }
      });
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.eventListeners.clear();
  }

  async request(req: IPCRequest): Promise<IPCResponse> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      this.pendingResolve = resolve;
      this.pendingReject = reject;

      // Set timeout to prevent hanging forever
      this.requestTimer = setTimeout(() => {
        this.pendingResolve = null;
        this.pendingReject = null;
        reject(new Error(`Request timed out after ${this.requestTimeout}ms`));
      }, this.requestTimeout);

      this.socket!.write(JSON.stringify(req) + '\n');
    });
  }

  onEvent(eventType: string, callback: EventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(callback);
  }

  offEvent(eventType: string, callback?: EventCallback): void {
    if (!this.eventListeners.has(eventType)) {
      return;
    }
    if (callback) {
      this.eventListeners.get(eventType)!.delete(callback);
    } else {
      this.eventListeners.delete(eventType);
    }
  }

  private emitEvent(eventType: string, data: unknown): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      for (const callback of listeners) {
        callback(data);
      }
    }
  }
}
