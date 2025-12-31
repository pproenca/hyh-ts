import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TrajectoryLogger } from './logger.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('TrajectoryLogger', () => {
  let tempDir: string;
  let logFile: string;
  let logger: TrajectoryLogger;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-trajectory-'));
    logFile = path.join(tempDir, 'trajectory.jsonl');
    logger = new TrajectoryLogger(logFile);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('appends events as JSONL', async () => {
    await logger.log({
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Read',
    });

    await logger.log({
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
    });

    const content = await fs.readFile(logFile, 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(2);

    const event1 = JSON.parse(lines[0]!);
    expect(event1.tool).toBe('Read');
  });

  it('returns last N events with tail', async () => {
    for (let i = 0; i < 10; i++) {
      await logger.log({
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'worker-1',
        tool: `Tool${i}`,
      });
    }

    const tail = await logger.tail(3);
    expect(tail).toHaveLength(3);
    expect(tail[0].tool).toBe('Tool7');
    expect(tail[2].tool).toBe('Tool9');
  });
});
