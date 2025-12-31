// packages/daemon/src/agents/process.ts
import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface AgentProcessConfig {
  agentId: string;
  model: 'haiku' | 'sonnet' | 'opus';
  sessionId: string;
  systemPromptPath: string;
  tools: string[];
  cwd: string;
}

export interface AgentEvent {
  type: 'tool_use' | 'tool_result' | 'message' | 'error' | 'exit';
  data?: unknown;
}

export class AgentProcess extends EventEmitter {
  readonly agentId: string;
  readonly model: string;
  readonly sessionId: string;
  private process: ChildProcess | null = null;
  private readonly config: AgentProcessConfig;

  constructor(config: AgentProcessConfig) {
    super();
    this.agentId = config.agentId;
    this.model = config.model;
    this.sessionId = config.sessionId;
    this.config = config;
  }

  get isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent already running');
    }

    const args = [
      '--session-id', this.sessionId,
      '--model', this.model,
      '--allowed-tools', this.config.tools.join(','),
      '--system-prompt', this.config.systemPromptPath,
      '--output-format', 'stream-json',
      '-p',
    ];

    this.process = spawn('claude', args, {
      cwd: this.config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.setupOutputParsing();
    this.setupErrorHandling();
  }

  async stop(): Promise<void> {
    if (!this.process) return;

    this.process.kill('SIGTERM');

    // Wait for graceful shutdown with timeout
    await Promise.race([
      new Promise<void>((resolve) => {
        this.process!.once('exit', () => resolve());
      }),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 5000);
      }),
    ]);

    this.process = null;
  }

  async injectPrompt(message: string): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Agent not running');
    }

    const injection = {
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: message }],
      },
    };

    this.process.stdin.write(JSON.stringify(injection) + '\n');
  }

  private setupOutputParsing(): void {
    if (!this.process?.stdout) return;

    let buffer = '';
    this.process.stdout.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this.emit('event', { type: event.type, data: event });
          } catch {
            // Non-JSON output
            this.emit('event', { type: 'message', data: line });
          }
        }
      }
    });
  }

  private setupErrorHandling(): void {
    if (!this.process) return;

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emit('error', new Error(data.toString()));
    });

    this.process.on('exit', (code) => {
      this.emit('event', { type: 'exit', data: { code } });
      this.process = null;
    });
  }
}
