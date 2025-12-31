// packages/daemon/src/checkers/todo.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { TodoChecker } from './todo.js';
import type { CheckContext, TrajectoryEvent } from './types.js';

describe('TodoChecker', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-todo-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it('returns violation when todo file has incomplete items', async () => {
    const todoPath = path.join(tmpDir, 'todo.md');
    await fs.writeFile(todoPath, `# Tasks\n- [x] Done task\n- [ ] Incomplete task`);

    const checker = new TodoChecker({
      file: todoPath,
      checkBeforeStop: true,
    });

    const event: TrajectoryEvent = {
      type: 'stop',
      timestamp: Date.now(),
      agentId: 'worker-1',
    };

    const ctx: CheckContext = {
      agentId: 'worker-1',
      event,
      trajectory: [],
      state: {},
    };

    const violation = checker.check(event, ctx);
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('incomplete_todo');
    expect(violation?.message).toContain('1');
  });

  it('returns null when all todo items are complete', async () => {
    const todoPath = path.join(tmpDir, 'todo.md');
    await fs.writeFile(todoPath, `# Tasks\n- [x] Done task 1\n- [x] Done task 2`);

    const checker = new TodoChecker({
      file: todoPath,
      checkBeforeStop: true,
    });

    const event: TrajectoryEvent = {
      type: 'stop',
      timestamp: Date.now(),
      agentId: 'worker-1',
    };

    const ctx: CheckContext = {
      agentId: 'worker-1',
      event,
      trajectory: [],
      state: {},
    };

    const violation = checker.check(event, ctx);
    expect(violation).toBeNull();
  });

  it('returns null when file does not exist', async () => {
    const checker = new TodoChecker({
      file: path.join(tmpDir, 'nonexistent.md'),
      checkBeforeStop: true,
    });

    const event: TrajectoryEvent = {
      type: 'stop',
      timestamp: Date.now(),
      agentId: 'worker-1',
    };

    const ctx: CheckContext = {
      agentId: 'worker-1',
      event,
      trajectory: [],
      state: {},
    };

    const violation = checker.check(event, ctx);
    expect(violation).toBeNull();
  });

  describe('appliesTo', () => {
    it('always returns true since todo checking applies globally', async () => {
      const checker = new TodoChecker({
        file: path.join(tmpDir, 'todo.md'),
        checkBeforeStop: true,
      });

      expect(checker.appliesTo('worker-1', {})).toBe(true);
      expect(checker.appliesTo('orchestrator', {})).toBe(true);
    });
  });

  describe('name property', () => {
    it('has name "todo"', () => {
      const checker = new TodoChecker({
        file: path.join(tmpDir, 'todo.md'),
        checkBeforeStop: true,
      });

      expect(checker.name).toBe('todo');
    });
  });
});

describe('TodoChecker markdown parsing', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-todo-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it('counts multiple incomplete items', async () => {
    const todoPath = path.join(tmpDir, 'todo.md');
    await fs.writeFile(
      todoPath,
      `# Tasks\n- [x] Done\n- [ ] Item 1\n- [ ] Item 2\n- [ ] Item 3`
    );

    const checker = new TodoChecker({ file: todoPath, checkBeforeStop: true });
    const event: TrajectoryEvent = {
      type: 'stop',
      timestamp: Date.now(),
      agentId: 'worker-1',
    };
    const ctx: CheckContext = {
      agentId: 'worker-1',
      event,
      trajectory: [],
      state: {},
    };

    const violation = checker.check(event, ctx);
    expect(violation?.message).toContain('3');
  });

  it('handles empty file', async () => {
    const todoPath = path.join(tmpDir, 'todo.md');
    await fs.writeFile(todoPath, '');

    const checker = new TodoChecker({ file: todoPath, checkBeforeStop: true });
    const event: TrajectoryEvent = {
      type: 'stop',
      timestamp: Date.now(),
      agentId: 'worker-1',
    };
    const ctx: CheckContext = {
      agentId: 'worker-1',
      event,
      trajectory: [],
      state: {},
    };

    const violation = checker.check(event, ctx);
    expect(violation).toBeNull();
  });

  it('handles file with only completed items', async () => {
    const todoPath = path.join(tmpDir, 'todo.md');
    await fs.writeFile(
      todoPath,
      `- [x] Item 1\n- [x] Item 2\n- [x] Item 3`
    );

    const checker = new TodoChecker({ file: todoPath, checkBeforeStop: true });
    const event: TrajectoryEvent = {
      type: 'stop',
      timestamp: Date.now(),
      agentId: 'worker-1',
    };
    const ctx: CheckContext = {
      agentId: 'worker-1',
      event,
      trajectory: [],
      state: {},
    };

    const violation = checker.check(event, ctx);
    expect(violation).toBeNull();
  });
});

describe('TodoChecker event filtering', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-todo-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it('only checks on stop events when checkBeforeStop is true', async () => {
    const todoPath = path.join(tmpDir, 'todo.md');
    await fs.writeFile(todoPath, `- [ ] Incomplete`);

    const checker = new TodoChecker({ file: todoPath, checkBeforeStop: true });

    // Non-stop event should not trigger check
    const toolEvent: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Read',
    };
    const ctx: CheckContext = {
      agentId: 'worker-1',
      event: toolEvent,
      trajectory: [],
      state: {},
    };

    const violation = checker.check(toolEvent, ctx);
    expect(violation).toBeNull();
  });
});

describe('TodoChecker violation correction', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-todo-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it('includes prompt correction in violation', async () => {
    const todoPath = path.join(tmpDir, 'todo.md');
    await fs.writeFile(todoPath, `- [ ] Incomplete task`);

    const checker = new TodoChecker({ file: todoPath, checkBeforeStop: true });
    const event: TrajectoryEvent = {
      type: 'stop',
      timestamp: Date.now(),
      agentId: 'worker-1',
    };
    const ctx: CheckContext = {
      agentId: 'worker-1',
      event,
      trajectory: [],
      state: {},
    };

    const violation = checker.check(event, ctx);
    expect(violation?.correction).toBeDefined();
    expect(violation?.correction?.type).toBe('prompt');
  });
});
