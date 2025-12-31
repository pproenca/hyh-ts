// packages/daemon/src/agents/output-parser.ts
import { Transform, TransformCallback } from 'node:stream';

export interface ClaudeEvent {
  type: 'assistant' | 'tool_use' | 'tool_result' | 'result' | 'error' | 'raw';
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: unknown;
  message?: unknown;
  data?: string;
}

export class ClaudeOutputParser extends Transform {
  private buffer = '';

  constructor() {
    super({ objectMode: true });
  }

  _transform(chunk: Buffer, _encoding: string, callback: TransformCallback): void {
    this.buffer += chunk.toString();

    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const event: ClaudeEvent = JSON.parse(line);
          this.push(event);
        } catch {
          // Non-JSON output - emit as raw
          this.push({ type: 'raw', data: line });
        }
      }
    }

    callback();
  }

  _flush(callback: TransformCallback): void {
    if (this.buffer.trim()) {
      try {
        const event: ClaudeEvent = JSON.parse(this.buffer);
        this.push(event);
      } catch {
        this.push({ type: 'raw', data: this.buffer });
      }
    }
    callback();
  }
}
