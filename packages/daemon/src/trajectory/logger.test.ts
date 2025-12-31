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

describe('TrajectoryLogger JSONL format', () => {
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

  it('writes valid JSONL format with newline after each entry', async () => {
    await logger.log({ type: 'event1', timestamp: 1 });
    await logger.log({ type: 'event2', timestamp: 2 });

    const content = await fs.readFile(logFile, 'utf-8');
    // Each line should be valid JSON and end with newline
    const lines = content.split('\n').filter(Boolean);
    expect(lines).toHaveLength(2);

    // Each line should be parseable independently
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('handles empty file for tail', async () => {
    const tail = await logger.tail(5);
    expect(tail).toEqual([]);
  });

  it('handles non-existent file for tail', async () => {
    const nonExistentLogger = new TrajectoryLogger('/tmp/does-not-exist.jsonl');
    const tail = await nonExistentLogger.tail(5);
    expect(tail).toEqual([]);
  });
});

describe('TrajectoryLogger filterByAgent', () => {
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

  it('filters events by agent ID', async () => {
    await logger.log({ type: 'a', timestamp: 1, agentId: 'worker-1' });
    await logger.log({ type: 'b', timestamp: 2, agentId: 'worker-2' });
    await logger.log({ type: 'c', timestamp: 3, agentId: 'worker-1' });
    await logger.log({ type: 'd', timestamp: 4, agentId: 'worker-3' });

    const agent1Events = await logger.filterByAgent('worker-1', 100);
    expect(agent1Events).toHaveLength(2);
    expect(agent1Events[0].type).toBe('a');
    expect(agent1Events[1].type).toBe('c');
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await logger.log({ type: `event${i}`, timestamp: i, agentId: 'worker-1' });
    }

    const events = await logger.filterByAgent('worker-1', 3);
    expect(events).toHaveLength(3);
  });

  it('returns empty array for non-existent file', async () => {
    const nonExistentLogger = new TrajectoryLogger('/tmp/does-not-exist.jsonl');
    const events = await nonExistentLogger.filterByAgent('worker-1', 10);
    expect(events).toEqual([]);
  });

  it('returns empty array when no events match agent', async () => {
    await logger.log({ type: 'a', timestamp: 1, agentId: 'worker-1' });
    await logger.log({ type: 'b', timestamp: 2, agentId: 'worker-2' });

    const events = await logger.filterByAgent('worker-3', 100);
    expect(events).toEqual([]);
  });
});

describe('TrajectoryLogger clear', () => {
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

  it('clears the trajectory log', async () => {
    await logger.log({ type: 'event', timestamp: 1 });
    await logger.log({ type: 'event', timestamp: 2 });

    await logger.clear();

    const tail = await logger.tail(10);
    expect(tail).toEqual([]);
  });

  it('handles clearing non-existent file', async () => {
    const nonExistentLogger = new TrajectoryLogger('/tmp/does-not-exist-clear.jsonl');
    await expect(nonExistentLogger.clear()).resolves.not.toThrow();
  });
});
