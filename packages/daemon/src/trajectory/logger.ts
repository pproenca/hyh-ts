import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { isNodeError } from '../utils/errors.js';

export interface TrajectoryEvent {
  type: string;
  timestamp: number;
  agentId?: string;
  [key: string]: unknown;
}

export class TrajectoryLogger {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async log(event: TrajectoryEvent): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    // Append as JSONL (one JSON object per line)
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(this.filePath, line);
  }

  async tail(n: number): Promise<TrajectoryEvent[]> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      return lines.slice(-n).map((line) => JSON.parse(line) as TrajectoryEvent);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async filterByAgent(agentId: string, limit: number): Promise<TrajectoryEvent[]> {
    const events: TrajectoryEvent[] = [];

    try {
      const stream = createReadStream(this.filePath);
      const rl = createInterface({ input: stream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as TrajectoryEvent;
        if (event.agentId === agentId) {
          events.push(event);
          if (events.length >= limit) break;
        }
      }
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    return events;
  }

  async clear(): Promise<void> {
    try {
      await fs.unlink(this.filePath);
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
