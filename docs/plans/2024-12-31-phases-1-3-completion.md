# hyh-ts Phases 1-3 Completion Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2024-12-31-phases-1-3-completion.md` to implement task-by-task.

**Goal:** Complete Phases 1-3 of hyh-ts by implementing missing runtime checkers, anti-abandonment patterns, context budget management, and verification commands.

**Architecture:** Build on existing foundation (143 tests passing). Add runtime checkers for all DSL invariants, managers for anti-abandonment patterns (re-injection, artifacts), and CLI commands for stop-hook verification.

**Tech Stack:** TypeScript 5.7+, Vitest, existing patterns from TddChecker/FileScopeChecker, picomatch for glob matching.

**Current State:** Core DSL, daemon, and CLI implemented. Missing: TodoChecker, PhaseToolChecker, ContextBudgetChecker, ReinjectionManager, ArtifactManager, verify-complete command.

---

## Task Group 1: Runtime Checkers (Parallel)

These tasks have no file overlap and can execute in parallel.

---

### Task 1: TodoChecker - External Todo Invariant

**Files:**
- Create: `packages/daemon/src/checkers/todo.ts`
- Create: `packages/daemon/src/checkers/todo.test.ts`
- Modify: `packages/daemon/src/index.ts:28-33`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/checkers/todo.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { TodoChecker } from './todo.js';
import type { CheckContext } from './types.js';

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

    const ctx: CheckContext = {
      agentId: 'worker-1',
      event: { type: 'stop', timestamp: Date.now(), agentId: 'worker-1' },
      trajectory: [],
      state: {} as any,
    };

    const violation = await checker.check(ctx);
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

    const ctx: CheckContext = {
      agentId: 'worker-1',
      event: { type: 'stop', timestamp: Date.now(), agentId: 'worker-1' },
      trajectory: [],
      state: {} as any,
    };

    const violation = await checker.check(ctx);
    expect(violation).toBeNull();
  });

  it('returns null when file does not exist', async () => {
    const checker = new TodoChecker({
      file: path.join(tmpDir, 'nonexistent.md'),
      checkBeforeStop: true,
    });

    const ctx: CheckContext = {
      agentId: 'worker-1',
      event: { type: 'stop', timestamp: Date.now(), agentId: 'worker-1' },
      trajectory: [],
      state: {} as any,
    };

    const violation = await checker.check(ctx);
    expect(violation).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/todo.test.ts
```

Expected: FAIL with `Cannot find module './todo.js'`

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/daemon/src/checkers/todo.ts
import * as fs from 'node:fs/promises';
import type { Checker, Violation, CheckContext } from './types.js';

export interface TodoCheckerOptions {
  file: string;
  checkBeforeStop: boolean;
}

export class TodoChecker implements Checker {
  private readonly options: TodoCheckerOptions;

  constructor(options: TodoCheckerOptions) {
    this.options = options;
  }

  async check(ctx: CheckContext): Promise<Violation | null> {
    // Only check on stop events if configured
    if (this.options.checkBeforeStop && ctx.event.type !== 'stop') {
      return null;
    }

    try {
      const content = await fs.readFile(this.options.file, 'utf-8');
      const incompleteItems = content.match(/- \[ \]/g) || [];

      if (incompleteItems.length > 0) {
        return {
          type: 'incomplete_todo',
          agentId: ctx.agentId,
          message: `${incompleteItems.length} todo items incomplete. Complete all items before stopping.`,
          correction: {
            type: 'prompt',
            message: 'Complete all todo items before stopping.',
          },
        };
      }

      return null;
    } catch (error) {
      // File doesn't exist - no violation
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/todo.test.ts
```

Expected: PASS (3 passed)

**Step 5: Export from package index** (2 min)

Add to `packages/daemon/src/index.ts` after line 32:

```typescript
export { TodoChecker } from './checkers/todo.js';
export type { TodoCheckerOptions } from './checkers/todo.js';
```

**Step 6: Commit** (30 sec)

```bash
git add packages/daemon/src/checkers/todo.ts packages/daemon/src/checkers/todo.test.ts packages/daemon/src/index.ts
git commit -m "feat(daemon): add TodoChecker for externalTodo invariant"
```

---

### Task 2: PhaseToolChecker - Expects/Forbids Enforcement

**Files:**
- Create: `packages/daemon/src/checkers/phase-tool.ts`
- Create: `packages/daemon/src/checkers/phase-tool.test.ts`
- Modify: `packages/daemon/src/index.ts:28-33`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/checkers/phase-tool.test.ts
import { describe, it, expect } from 'vitest';
import { PhaseToolChecker } from './phase-tool.js';
import type { CheckContext } from './types.js';
import type { CompiledPhase } from '@hyh/dsl';

describe('PhaseToolChecker', () => {
  const phase: CompiledPhase = {
    name: 'explore',
    agent: 'orchestrator',
    expects: ['Read', 'Grep', 'Glob'],
    forbids: ['Write', 'Edit'],
    outputs: [],
    requires: [],
    parallel: false,
  };

  it('returns violation for forbidden tool', () => {
    const checker = new PhaseToolChecker(phase);
    const ctx: CheckContext = {
      agentId: 'orchestrator',
      event: {
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'orchestrator',
        tool: 'Write',
        args: { path: 'file.ts' },
      },
      trajectory: [],
      state: { currentPhase: 'explore' } as any,
    };

    const violation = checker.check(ctx);
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('forbidden_tool');
    expect(violation?.message).toContain('Write');
    expect(violation?.correction?.type).toBe('block');
  });

  it('returns warning for unexpected tool', () => {
    const checker = new PhaseToolChecker(phase);
    const ctx: CheckContext = {
      agentId: 'orchestrator',
      event: {
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'orchestrator',
        tool: 'Bash',
        args: { command: 'ls' },
      },
      trajectory: [],
      state: { currentPhase: 'explore' } as any,
    };

    const violation = checker.check(ctx);
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('unexpected_tool');
    expect(violation?.correction?.type).toBe('warn');
  });

  it('returns null for expected tool', () => {
    const checker = new PhaseToolChecker(phase);
    const ctx: CheckContext = {
      agentId: 'orchestrator',
      event: {
        type: 'tool_use',
        timestamp: Date.now(),
        agentId: 'orchestrator',
        tool: 'Read',
        args: { path: 'file.ts' },
      },
      trajectory: [],
      state: { currentPhase: 'explore' } as any,
    };

    const violation = checker.check(ctx);
    expect(violation).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/phase-tool.test.ts
```

Expected: FAIL with `Cannot find module './phase-tool.js'`

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/daemon/src/checkers/phase-tool.ts
import type { Checker, Violation, CheckContext } from './types.js';
import type { CompiledPhase } from '@hyh/dsl';

export class PhaseToolChecker implements Checker {
  private readonly phase: CompiledPhase;

  constructor(phase: CompiledPhase) {
    this.phase = phase;
  }

  check(ctx: CheckContext): Violation | null {
    // Only check tool_use events
    if (ctx.event.type !== 'tool_use') {
      return null;
    }

    const tool = (ctx.event as any).tool;
    if (!tool) return null;

    // Check forbidden tools (hard block)
    if (this.phase.forbids?.includes(tool)) {
      return {
        type: 'forbidden_tool',
        agentId: ctx.agentId,
        message: `Tool '${tool}' is forbidden in phase '${this.phase.name}'`,
        correction: {
          type: 'block',
          message: `${tool} is not allowed in ${this.phase.name} phase`,
        },
      };
    }

    // Check expected tools (soft warning)
    if (this.phase.expects?.length > 0 && !this.phase.expects.includes(tool)) {
      return {
        type: 'unexpected_tool',
        agentId: ctx.agentId,
        message: `Tool '${tool}' is unusual in phase '${this.phase.name}'`,
        correction: {
          type: 'warn',
          message: `${tool} is not typically used in ${this.phase.name} phase`,
        },
      };
    }

    return null;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/phase-tool.test.ts
```

Expected: PASS (3 passed)

**Step 5: Export from package index** (2 min)

Add to `packages/daemon/src/index.ts`:

```typescript
export { PhaseToolChecker } from './checkers/phase-tool.js';
```

**Step 6: Commit** (30 sec)

```bash
git add packages/daemon/src/checkers/phase-tool.ts packages/daemon/src/checkers/phase-tool.test.ts packages/daemon/src/index.ts
git commit -m "feat(daemon): add PhaseToolChecker for expects/forbids enforcement"
```

---

### Task 3: ContextBudgetChecker - Token Limit Enforcement

**Files:**
- Create: `packages/daemon/src/checkers/context-budget.ts`
- Create: `packages/daemon/src/checkers/context-budget.test.ts`
- Modify: `packages/daemon/src/index.ts:28-33`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/checkers/context-budget.test.ts
import { describe, it, expect } from 'vitest';
import { ContextBudgetChecker, estimateTokens } from './context-budget.js';
import type { CheckContext } from './types.js';

describe('estimateTokens', () => {
  it('estimates ~1 token per 4 characters', () => {
    const text = 'a'.repeat(400);
    expect(estimateTokens(text)).toBe(100);
  });
});

describe('ContextBudgetChecker', () => {
  it('returns violation when context exceeds 80% limit', () => {
    const checker = new ContextBudgetChecker({
      max: 0.8,
      warn: 0.6,
      modelLimit: 1000, // 1000 tokens limit for test
    });

    // 850 tokens worth of trajectory (85% of 1000)
    const trajectory = Array(10).fill({
      type: 'message',
      timestamp: Date.now(),
      agentId: 'worker',
      data: 'x'.repeat(340), // 85 tokens each = 850 total
    });

    const ctx: CheckContext = {
      agentId: 'worker',
      event: { type: 'message', timestamp: Date.now(), agentId: 'worker' },
      trajectory,
      state: {} as any,
    };

    const violation = checker.check(ctx);
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('context_exceeded');
    expect(violation?.correction?.type).toBe('prompt');
  });

  it('returns warning when context exceeds warn threshold', () => {
    const checker = new ContextBudgetChecker({
      max: 0.8,
      warn: 0.6,
      modelLimit: 1000,
    });

    // 650 tokens (65% - above warn but below max)
    const trajectory = Array(10).fill({
      type: 'message',
      timestamp: Date.now(),
      agentId: 'worker',
      data: 'x'.repeat(260), // 65 tokens each
    });

    const ctx: CheckContext = {
      agentId: 'worker',
      event: { type: 'message', timestamp: Date.now(), agentId: 'worker' },
      trajectory,
      state: {} as any,
    };

    const violation = checker.check(ctx);
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('context_warning');
    expect(violation?.correction?.type).toBe('warn');
  });

  it('returns null when context is within limits', () => {
    const checker = new ContextBudgetChecker({
      max: 0.8,
      warn: 0.6,
      modelLimit: 1000,
    });

    const trajectory = Array(5).fill({
      type: 'message',
      timestamp: Date.now(),
      agentId: 'worker',
      data: 'x'.repeat(200), // 50 tokens each = 250 total (25%)
    });

    const ctx: CheckContext = {
      agentId: 'worker',
      event: { type: 'message', timestamp: Date.now(), agentId: 'worker' },
      trajectory,
      state: {} as any,
    };

    const violation = checker.check(ctx);
    expect(violation).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/context-budget.test.ts
```

Expected: FAIL with `Cannot find module './context-budget.js'`

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/daemon/src/checkers/context-budget.ts
import type { Checker, Violation, CheckContext } from './types.js';

export interface ContextBudgetOptions {
  max: number;       // e.g., 0.8 for 80%
  warn?: number;     // e.g., 0.6 for 60%
  modelLimit: number; // Total token limit for model
}

// Rough estimation: 1 token ≈ 4 characters
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class ContextBudgetChecker implements Checker {
  private readonly options: ContextBudgetOptions;

  constructor(options: ContextBudgetOptions) {
    this.options = options;
  }

  check(ctx: CheckContext): Violation | null {
    // Estimate total tokens in trajectory
    let totalTokens = 0;
    for (const event of ctx.trajectory) {
      const eventStr = JSON.stringify(event);
      totalTokens += estimateTokens(eventStr);
    }

    const usage = totalTokens / this.options.modelLimit;

    // Check max threshold
    if (usage > this.options.max) {
      return {
        type: 'context_exceeded',
        agentId: ctx.agentId,
        message: `Context at ${Math.round(usage * 100)}% of limit (max ${Math.round(this.options.max * 100)}%)`,
        correction: {
          type: 'prompt',
          message: 'Context limit exceeded. Summarize key decisions and continue.',
        },
      };
    }

    // Check warn threshold
    if (this.options.warn && usage > this.options.warn) {
      return {
        type: 'context_warning',
        agentId: ctx.agentId,
        message: `Context at ${Math.round(usage * 100)}% of limit`,
        correction: {
          type: 'warn',
          message: `Context usage high (${Math.round(usage * 100)}%)`,
        },
      };
    }

    return null;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/context-budget.test.ts
```

Expected: PASS (4 passed)

**Step 5: Export from package index** (2 min)

Add to `packages/daemon/src/index.ts`:

```typescript
export { ContextBudgetChecker, estimateTokens } from './checkers/context-budget.js';
export type { ContextBudgetOptions } from './checkers/context-budget.js';
```

**Step 6: Commit** (30 sec)

```bash
git add packages/daemon/src/checkers/context-budget.ts packages/daemon/src/checkers/context-budget.test.ts packages/daemon/src/index.ts
git commit -m "feat(daemon): add ContextBudgetChecker for context limit enforcement"
```

---

## Task Group 2: Anti-Abandonment Managers (Parallel)

---

### Task 4: ReinjectionManager - Periodic Task Reminder

**Files:**
- Create: `packages/daemon/src/managers/reinjection.ts`
- Create: `packages/daemon/src/managers/reinjection.test.ts`
- Modify: `packages/daemon/src/index.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/managers/reinjection.test.ts
import { describe, it, expect } from 'vitest';
import { ReinjectionManager } from './reinjection.js';

describe('ReinjectionManager', () => {
  it('returns null until threshold reached', () => {
    const manager = new ReinjectionManager({
      every: 5,
      template: (ctx) => `Reminder: ${ctx.objective}`,
    });

    // First 4 tool uses - no reinjection
    for (let i = 0; i < 4; i++) {
      const result = manager.onToolUse('worker-1', {
        objective: 'Implement token service',
        todoIncomplete: 2,
      });
      expect(result).toBeNull();
    }
  });

  it('returns reinjection message at threshold', () => {
    const manager = new ReinjectionManager({
      every: 5,
      template: (ctx) => `Reminder: ${ctx.objective}\nRemaining: ${ctx.todoIncomplete} items`,
    });

    // 4 tool uses
    for (let i = 0; i < 4; i++) {
      manager.onToolUse('worker-1', {
        objective: 'Implement token service',
        todoIncomplete: 2,
      });
    }

    // 5th tool use - trigger reinjection
    const result = manager.onToolUse('worker-1', {
      objective: 'Implement token service',
      todoIncomplete: 2,
    });

    expect(result).not.toBeNull();
    expect(result).toContain('Reminder: Implement token service');
    expect(result).toContain('Remaining: 2 items');
  });

  it('tracks agents independently', () => {
    const manager = new ReinjectionManager({
      every: 3,
      template: (ctx) => `Focus on: ${ctx.objective}`,
    });

    // Agent 1: 2 uses
    manager.onToolUse('worker-1', { objective: 'Task A' });
    manager.onToolUse('worker-1', { objective: 'Task A' });

    // Agent 2: 3 uses - triggers
    manager.onToolUse('worker-2', { objective: 'Task B' });
    manager.onToolUse('worker-2', { objective: 'Task B' });
    const result2 = manager.onToolUse('worker-2', { objective: 'Task B' });
    expect(result2).toContain('Task B');

    // Agent 1: 1 more use (3rd) - triggers
    const result1 = manager.onToolUse('worker-1', { objective: 'Task A' });
    expect(result1).toContain('Task A');
  });

  it('resets count after reinjection', () => {
    const manager = new ReinjectionManager({
      every: 2,
      template: () => 'reminder',
    });

    manager.onToolUse('worker-1', {});
    const first = manager.onToolUse('worker-1', {});
    expect(first).toBe('reminder');

    // Count resets - next trigger is at count 4
    manager.onToolUse('worker-1', {});
    const second = manager.onToolUse('worker-1', {});
    expect(second).toBe('reminder');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/managers/reinjection.test.ts
```

Expected: FAIL with `Cannot find module './reinjection.js'`

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/daemon/src/managers/reinjection.ts
export interface ReinjectionContext {
  objective?: string;
  todoIncomplete?: number;
  [key: string]: unknown;
}

export interface ReinjectionOptions {
  every: number;
  template: (ctx: ReinjectionContext) => string;
}

export class ReinjectionManager {
  private readonly options: ReinjectionOptions;
  private readonly toolCounts: Map<string, number> = new Map();

  constructor(options: ReinjectionOptions) {
    this.options = options;
  }

  /**
   * Called on each tool use. Returns reinjection message if threshold reached.
   */
  onToolUse(agentId: string, context: ReinjectionContext): string | null {
    const count = (this.toolCounts.get(agentId) || 0) + 1;
    this.toolCounts.set(agentId, count);

    if (count % this.options.every === 0) {
      return this.options.template(context);
    }

    return null;
  }

  /**
   * Reset count for an agent (e.g., on task completion)
   */
  reset(agentId: string): void {
    this.toolCounts.delete(agentId);
  }

  /**
   * Get current tool count for an agent
   */
  getCount(agentId: string): number {
    return this.toolCounts.get(agentId) || 0;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/managers/reinjection.test.ts
```

Expected: PASS (4 passed)

**Step 5: Export from package index** (2 min)

Add to `packages/daemon/src/index.ts`:

```typescript
export { ReinjectionManager } from './managers/reinjection.js';
export type { ReinjectionOptions, ReinjectionContext } from './managers/reinjection.js';
```

**Step 6: Commit** (30 sec)

```bash
git add packages/daemon/src/managers/reinjection.ts packages/daemon/src/managers/reinjection.test.ts packages/daemon/src/index.ts
git commit -m "feat(daemon): add ReinjectionManager for periodic task reminders"
```

---

### Task 5: ArtifactManager - Task Completion Artifacts

**Files:**
- Create: `packages/daemon/src/managers/artifact.ts`
- Create: `packages/daemon/src/managers/artifact.test.ts`
- Modify: `packages/daemon/src/index.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/managers/artifact.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { ArtifactManager, Artifact } from './artifact.js';

describe('ArtifactManager', () => {
  let tmpDir: string;
  let manager: ArtifactManager;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-artifact-test-'));
    manager = new ArtifactManager(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true });
  });

  it('saves artifact as markdown', async () => {
    const artifact: Artifact = {
      taskId: 'token-service',
      status: 'complete',
      summary: {
        objective: 'Implement JWT token service',
        outcome: 'Successfully implemented token generation and validation',
      },
      files: {
        modified: ['src/auth/token.ts'],
        created: ['tests/auth/token.test.ts'],
      },
      exports: [
        { name: 'generateToken', type: 'function', location: 'src/auth/token.ts' },
      ],
      tests: { total: 8, passed: 8 },
      notes: ['Uses HS256 algorithm', 'Token expires in 1 hour'],
    };

    await manager.save(artifact);

    const saved = await fs.readFile(
      path.join(tmpDir, 'token-service.md'),
      'utf-8'
    );
    expect(saved).toContain('# token-service');
    expect(saved).toContain('Implement JWT token service');
    expect(saved).toContain('8/8 tests passed');
    expect(saved).toContain('generateToken');
  });

  it('loads artifact by task ID', async () => {
    const artifact: Artifact = {
      taskId: 'session-manager',
      status: 'complete',
      summary: {
        objective: 'Implement session management',
        outcome: 'Sessions work',
      },
      files: { modified: [], created: ['src/session.ts'] },
      exports: [],
      tests: { total: 4, passed: 4 },
      notes: [],
    };

    await manager.save(artifact);
    const loaded = await manager.load('session-manager');

    expect(loaded).not.toBeNull();
    expect(loaded?.taskId).toBe('session-manager');
    expect(loaded?.status).toBe('complete');
  });

  it('returns null for nonexistent artifact', async () => {
    const loaded = await manager.load('nonexistent');
    expect(loaded).toBeNull();
  });

  it('loads interfaces for dependent tasks', async () => {
    // Save two artifacts
    await manager.save({
      taskId: 'task-a',
      status: 'complete',
      summary: { objective: 'Task A', outcome: 'Done' },
      files: { modified: [], created: [] },
      exports: [{ name: 'funcA', type: 'function', location: 'a.ts' }],
      tests: { total: 1, passed: 1 },
      notes: ['Note A'],
    });

    await manager.save({
      taskId: 'task-b',
      status: 'complete',
      summary: { objective: 'Task B', outcome: 'Done' },
      files: { modified: [], created: [] },
      exports: [{ name: 'funcB', type: 'function', location: 'b.ts' }],
      tests: { total: 2, passed: 2 },
      notes: [],
    });

    const context = await manager.loadForDependencies(['task-a', 'task-b']);
    expect(context).toContain('funcA');
    expect(context).toContain('funcB');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/managers/artifact.test.ts
```

Expected: FAIL with `Cannot find module './artifact.js'`

**Step 3: Write minimal implementation** (7 min)

```typescript
// packages/daemon/src/managers/artifact.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface Artifact {
  taskId: string;
  status: 'complete' | 'partial' | 'failed';
  summary: {
    objective: string;
    outcome: string;
  };
  files: {
    modified: string[];
    created: string[];
  };
  exports: Array<{
    name: string;
    type: string;
    location: string;
  }>;
  tests: {
    total: number;
    passed: number;
    coverage?: number;
  };
  notes: string[];
}

export class ArtifactManager {
  private readonly dir: string;

  constructor(artifactDir: string) {
    this.dir = artifactDir;
  }

  async save(artifact: Artifact): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const markdown = this.formatMarkdown(artifact);
    const filePath = path.join(this.dir, `${artifact.taskId}.md`);
    await fs.writeFile(filePath, markdown);
  }

  async load(taskId: string): Promise<Artifact | null> {
    try {
      const filePath = path.join(this.dir, `${taskId}.md`);
      const content = await fs.readFile(filePath, 'utf-8');
      return this.parseMarkdown(taskId, content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async loadForDependencies(taskIds: string[]): Promise<string> {
    const sections: string[] = [];

    for (const taskId of taskIds) {
      const artifact = await this.load(taskId);
      if (artifact) {
        sections.push(this.extractInterface(artifact));
      }
    }

    return sections.join('\n\n');
  }

  private formatMarkdown(artifact: Artifact): string {
    const lines: string[] = [];

    lines.push(`# ${artifact.taskId}`);
    lines.push('');
    lines.push(`## Status: ${artifact.status}`);
    lines.push('');
    lines.push(`## Objective`);
    lines.push(artifact.summary.objective);
    lines.push('');
    lines.push(`## Outcome`);
    lines.push(artifact.summary.outcome);
    lines.push('');

    if (artifact.files.created.length > 0 || artifact.files.modified.length > 0) {
      lines.push('## Files');
      for (const f of artifact.files.created) {
        lines.push(`- Created: ${f}`);
      }
      for (const f of artifact.files.modified) {
        lines.push(`- Modified: ${f}`);
      }
      lines.push('');
    }

    if (artifact.exports.length > 0) {
      lines.push('## Exports');
      for (const e of artifact.exports) {
        lines.push(`- \`${e.name}\` (${e.type}) from ${e.location}`);
      }
      lines.push('');
    }

    lines.push('## Tests');
    lines.push(`${artifact.tests.passed}/${artifact.tests.total} tests passed`);
    if (artifact.tests.coverage !== undefined) {
      lines.push(`Coverage: ${artifact.tests.coverage}%`);
    }
    lines.push('');

    if (artifact.notes.length > 0) {
      lines.push('## Notes');
      for (const note of artifact.notes) {
        lines.push(`- ${note}`);
      }
    }

    return lines.join('\n');
  }

  private parseMarkdown(taskId: string, content: string): Artifact {
    // Simplified parser - extracts key info from markdown
    const statusMatch = content.match(/## Status: (\w+)/);
    const objectiveMatch = content.match(/## Objective\n(.+)/);
    const outcomeMatch = content.match(/## Outcome\n(.+)/);
    const testsMatch = content.match(/(\d+)\/(\d+) tests passed/);

    return {
      taskId,
      status: (statusMatch?.[1] as Artifact['status']) || 'complete',
      summary: {
        objective: objectiveMatch?.[1] || '',
        outcome: outcomeMatch?.[1] || '',
      },
      files: { modified: [], created: [] },
      exports: this.parseExports(content),
      tests: {
        passed: testsMatch ? parseInt(testsMatch[1]) : 0,
        total: testsMatch ? parseInt(testsMatch[2]) : 0,
      },
      notes: [],
    };
  }

  private parseExports(content: string): Artifact['exports'] {
    const exports: Artifact['exports'] = [];
    const exportSection = content.match(/## Exports\n([\s\S]*?)(?=\n##|$)/);
    if (exportSection) {
      const lines = exportSection[1].split('\n');
      for (const line of lines) {
        const match = line.match(/- `(\w+)` \((\w+)\) from (.+)/);
        if (match) {
          exports.push({ name: match[1], type: match[2], location: match[3] });
        }
      }
    }
    return exports;
  }

  private extractInterface(artifact: Artifact): string {
    const lines: string[] = [];
    lines.push(`### ${artifact.taskId}`);
    lines.push(`Status: ${artifact.status}`);

    if (artifact.exports.length > 0) {
      lines.push('Exports:');
      for (const e of artifact.exports) {
        lines.push(`  - ${e.name}: ${e.type}`);
      }
    }

    return lines.join('\n');
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/managers/artifact.test.ts
```

Expected: PASS (4 passed)

**Step 5: Export from package index** (2 min)

Add to `packages/daemon/src/index.ts`:

```typescript
export { ArtifactManager } from './managers/artifact.js';
export type { Artifact } from './managers/artifact.js';
```

**Step 6: Commit** (30 sec)

```bash
git add packages/daemon/src/managers/artifact.ts packages/daemon/src/managers/artifact.test.ts packages/daemon/src/index.ts
git commit -m "feat(daemon): add ArtifactManager for task completion artifacts"
```

---

## Task Group 3: CLI Verification Commands (Sequential - share CLI patterns)

---

### Task 6: verify-complete Command - Stop Hook Verification

**Files:**
- Create: `packages/cli/src/commands/verify-complete.ts`
- Create: `packages/cli/src/commands/verify-complete.test.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/cli/src/commands/verify-complete.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('verify-complete command', () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-verify-test-'));
    originalCwd = process.cwd();
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true });
  });

  it('passes when no todo file exists', async () => {
    const { verifyComplete } = await import('./verify-complete.js');
    const result = await verifyComplete();
    expect(result.passed).toBe(true);
  });

  it('fails when todo has incomplete items', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'todo.md'),
      '- [x] Done\n- [ ] Not done'
    );

    const { verifyComplete } = await import('./verify-complete.js');
    const result = await verifyComplete({ todoFile: 'todo.md' });

    expect(result.passed).toBe(false);
    expect(result.errors).toContain('1 incomplete todo items');
  });

  it('passes when all todos complete', async () => {
    await fs.writeFile(
      path.join(tmpDir, 'todo.md'),
      '- [x] Task 1\n- [x] Task 2'
    );

    const { verifyComplete } = await import('./verify-complete.js');
    const result = await verifyComplete({ todoFile: 'todo.md' });

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/cli/src/commands/verify-complete.test.ts
```

Expected: FAIL with `Cannot find module './verify-complete.js'`

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/cli/src/commands/verify-complete.ts
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

interface VerifyOptions {
  todoFile?: string;
  runTests?: boolean;
  runTypecheck?: boolean;
}

interface VerifyResult {
  passed: boolean;
  errors: string[];
}

export async function verifyComplete(options: VerifyOptions = {}): Promise<VerifyResult> {
  const errors: string[] = [];

  // Check todo file if specified
  const todoPath = options.todoFile || 'todo.md';
  try {
    const content = await fs.readFile(path.resolve(todoPath), 'utf-8');
    const incomplete = (content.match(/- \[ \]/g) || []).length;
    if (incomplete > 0) {
      errors.push(`${incomplete} incomplete todo items`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // File doesn't exist - OK
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

export function registerVerifyCompleteCommand(program: Command): void {
  program
    .command('verify-complete')
    .description('Verify task completion before stopping')
    .option('--todo-file <file>', 'Path to todo file', 'todo.md')
    .option('--no-tests', 'Skip test verification')
    .option('--no-typecheck', 'Skip typecheck verification')
    .action(async (options) => {
      const result = await verifyComplete({
        todoFile: options.todoFile,
        runTests: options.tests !== false,
        runTypecheck: options.typecheck !== false,
      });

      if (result.passed) {
        console.log('✅ All verification checks passed');
        process.exit(0);
      } else {
        console.log('❌ Verification failed:');
        for (const error of result.errors) {
          console.log(`  - ${error}`);
        }
        console.log('\nContinue working to complete all items.');
        process.exit(1);
      }
    });
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/cli/src/commands/verify-complete.test.ts
```

Expected: PASS (3 passed)

**Step 5: Register command in CLI** (2 min)

Add to `packages/cli/src/index.ts`:

```typescript
import { registerVerifyCompleteCommand } from './commands/verify-complete.js';
// ... (after other register calls)
registerVerifyCompleteCommand(program);
```

**Step 6: Commit** (30 sec)

```bash
git add packages/cli/src/commands/verify-complete.ts packages/cli/src/commands/verify-complete.test.ts packages/cli/src/index.ts
git commit -m "feat(cli): add verify-complete command for stop hook"
```

---

### Task 7: Enhanced Hooks Generator - PostToolUse and SubagentStop

**Files:**
- Modify: `packages/dsl/src/compiler/hooks-generator.ts`
- Modify: `packages/dsl/src/compiler/hooks-generator.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// Add to packages/dsl/src/compiler/hooks-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateHooksJson } from './hooks-generator.js';
import type { CompiledWorkflow } from '../types/compiled.js';

describe('generateHooksJson', () => {
  const workflow: CompiledWorkflow = {
    name: 'test',
    resumable: true,
    orchestrator: 'orchestrator',
    agents: {
      orchestrator: {
        name: 'orchestrator',
        model: 'opus',
        role: 'coordinator',
        tools: ['Read'],
        invariants: [],
        spawns: [],
        violations: {},
        systemPrompt: '',
      },
      worker: {
        name: 'worker',
        model: 'sonnet',
        role: 'implementation',
        tools: ['Read', 'Write'],
        invariants: [],
        spawns: [],
        violations: {},
        systemPrompt: '',
        postToolUse: {
          matcher: 'Write|Edit',
          commands: ['npm run typecheck'],
        },
        subagentStop: {
          verify: ['npm test'],
        },
      },
    },
    phases: [],
    queues: {},
    gates: {},
  };

  it('generates basic hooks', () => {
    const hooks = generateHooksJson(workflow);
    expect(hooks.hooks.SessionStart).toBeDefined();
    expect(hooks.hooks.Stop).toBeDefined();
  });

  it('generates PostToolUse hooks from agent config', () => {
    const hooks = generateHooksJson(workflow);
    expect(hooks.hooks.PostToolUse).toBeDefined();
    expect(hooks.hooks.PostToolUse?.[0].matcher).toBe('Write|Edit');
    expect(hooks.hooks.PostToolUse?.[0].hooks[0].command).toContain('typecheck');
  });

  it('generates SubagentStop hooks from agent config', () => {
    const hooks = generateHooksJson(workflow);
    expect(hooks.hooks.SubagentStop).toBeDefined();
    expect(hooks.hooks.SubagentStop?.[0].hooks[0].command).toContain('test');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/hooks-generator.test.ts
```

Expected: FAIL (test for PostToolUse hooks)

**Step 3: Update implementation** (5 min)

```typescript
// packages/dsl/src/compiler/hooks-generator.ts
import { CompiledWorkflow } from '../types/compiled.js';

interface HookEntry {
  type: 'command';
  command: string;
  timeout?: number;
}

interface HookMatcher {
  matcher: string;
  hooks: HookEntry[];
}

interface HooksConfig {
  hooks: {
    SessionStart?: HookMatcher[];
    Stop?: HookMatcher[];
    PostToolUse?: HookMatcher[];
    SubagentStop?: HookMatcher[];
    PreCompact?: HookMatcher[];
  };
}

export function generateHooksJson(workflow: CompiledWorkflow): HooksConfig {
  const hooks: HooksConfig = {
    hooks: {},
  };

  // SessionStart hook - show workflow status
  hooks.hooks.SessionStart = [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: 'hyh status --quiet',
    }],
  }];

  // Stop hook - verify completion
  hooks.hooks.Stop = [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: 'hyh verify-complete',
      timeout: 120,
    }],
  }];

  // Collect PostToolUse hooks from agents
  const postToolUseHooks: HookMatcher[] = [];
  const subagentStopHooks: HookMatcher[] = [];

  for (const agent of Object.values(workflow.agents)) {
    // PostToolUse from agent config
    if (agent.postToolUse) {
      postToolUseHooks.push({
        matcher: agent.postToolUse.matcher,
        hooks: agent.postToolUse.commands.map(cmd => ({
          type: 'command' as const,
          command: cmd,
          timeout: 30,
        })),
      });
    }

    // SubagentStop from agent config
    if (agent.subagentStop) {
      subagentStopHooks.push({
        matcher: '',
        hooks: agent.subagentStop.verify.map(cmd => ({
          type: 'command' as const,
          command: cmd,
          timeout: 120,
        })),
      });
    }
  }

  if (postToolUseHooks.length > 0) {
    hooks.hooks.PostToolUse = postToolUseHooks;
  }

  if (subagentStopHooks.length > 0) {
    hooks.hooks.SubagentStop = subagentStopHooks;
  }

  return hooks;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/hooks-generator.test.ts
```

Expected: PASS (3 passed)

**Step 5: Update CompiledAgent type** (3 min)

Add to `packages/dsl/src/types/compiled.ts`:

```typescript
export interface CompiledAgent {
  // ... existing fields
  postToolUse?: {
    matcher: string;
    commands: string[];
  };
  subagentStop?: {
    verify: string[];
  };
}
```

**Step 6: Commit** (30 sec)

```bash
git add packages/dsl/src/compiler/hooks-generator.ts packages/dsl/src/compiler/hooks-generator.test.ts packages/dsl/src/types/compiled.ts
git commit -m "feat(dsl): extend hooks generator for PostToolUse and SubagentStop"
```

---

### Task 8: Integrate New Checkers into CheckerChain

**Files:**
- Modify: `packages/daemon/src/checkers/chain.ts`
- Modify: `packages/daemon/src/checkers/chain.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// Add to packages/daemon/src/checkers/chain.test.ts
describe('CheckerChain with new checkers', () => {
  it('builds chain from workflow with all invariant types', () => {
    const workflow: CompiledWorkflow = {
      name: 'test',
      resumable: false,
      orchestrator: 'orchestrator',
      agents: {
        worker: {
          name: 'worker',
          model: 'sonnet',
          role: 'implementation',
          tools: ['Read', 'Write'],
          invariants: [
            { type: 'tdd', options: { test: '**/*.test.ts', impl: 'src/**/*.ts' } },
            { type: 'fileScope', options: { getter: '["src/auth.ts"]' } },
            { type: 'externalTodo', options: { file: 'todo.md', checkBeforeStop: true } },
            { type: 'contextLimit', options: { max: 0.8, warn: 0.6 } },
          ],
          spawns: [],
          violations: {},
          systemPrompt: '',
        },
      },
      phases: [{
        name: 'implement',
        agent: 'worker',
        expects: ['Read', 'Write'],
        forbids: ['Bash'],
        outputs: [],
        requires: [],
        parallel: false,
      }],
      queues: {},
      gates: {},
    };

    const chain = new CheckerChain(workflow);
    expect(chain.checkerCount).toBeGreaterThanOrEqual(5); // tdd, fileScope, todo, context, phase
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/chain.test.ts
```

Expected: FAIL (new invariant types not handled)

**Step 3: Update CheckerChain implementation** (5 min)

Add to `packages/daemon/src/checkers/chain.ts`:

```typescript
import { TodoChecker } from './todo.js';
import { ContextBudgetChecker } from './context-budget.js';
import { PhaseToolChecker } from './phase-tool.js';

// In buildCheckers method, add cases:
case 'externalTodo':
  checkers.push(new TodoChecker({
    file: inv.options?.file || 'todo.md',
    checkBeforeStop: inv.options?.checkBeforeStop ?? true,
  }));
  break;

case 'contextLimit':
  checkers.push(new ContextBudgetChecker({
    max: inv.options?.max || 0.8,
    warn: inv.options?.warn,
    modelLimit: this.getModelLimit(agent.model),
  }));
  break;

// Add phase tool checker for each phase
for (const phase of workflow.phases) {
  if (phase.expects?.length > 0 || phase.forbids?.length > 0) {
    checkers.push(new PhaseToolChecker(phase));
  }
}

// Add helper method
private getModelLimit(model: string): number {
  const limits: Record<string, number> = {
    'haiku': 200000,
    'sonnet': 200000,
    'opus': 200000,
  };
  return limits[model] || 200000;
}

// Add getter
get checkerCount(): number {
  return this.checkers.length;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/chain.test.ts
```

Expected: PASS (5 passed)

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/checkers/chain.ts packages/daemon/src/checkers/chain.test.ts
git commit -m "feat(daemon): integrate TodoChecker, ContextBudgetChecker, PhaseToolChecker into chain"
```

---

## Task Group 4: Integration and Polish

---

### Task 9: AgentBuilder DSL - postToolUse and subagentStop Methods

**Files:**
- Modify: `packages/dsl/src/builders/agent.ts`
- Modify: `packages/dsl/src/builders/agent.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// Add to packages/dsl/src/builders/agent.test.ts
describe('AgentBuilder anti-abandonment', () => {
  it('adds postToolUse configuration', () => {
    const ag = agent('worker')
      .model('sonnet')
      .role('implementation')
      .postToolUse({
        matcher: 'Write|Edit',
        run: ['npm run typecheck', 'npm run lint --fix'],
      });

    const compiled = ag.build();
    expect(compiled.postToolUse).toBeDefined();
    expect(compiled.postToolUse?.matcher).toBe('Write|Edit');
    expect(compiled.postToolUse?.commands).toContain('npm run typecheck');
  });

  it('adds subagentStop configuration', () => {
    const ag = agent('worker')
      .model('sonnet')
      .role('implementation')
      .subagentStop({
        verify: ['npm test', 'hyh verify-complete'],
      });

    const compiled = ag.build();
    expect(compiled.subagentStop).toBeDefined();
    expect(compiled.subagentStop?.verify).toContain('npm test');
  });

  it('adds reinject configuration', () => {
    const ag = agent('worker')
      .model('sonnet')
      .role('implementation')
      .reinject({
        every: 5,
        content: 'Stay focused on the task',
      });

    const compiled = ag.build();
    expect(compiled.reinject).toBeDefined();
    expect(compiled.reinject?.every).toBe(5);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/dsl/src/builders/agent.test.ts
```

Expected: FAIL (methods not defined)

**Step 3: Update AgentBuilder** (5 min)

Add to `packages/dsl/src/builders/agent.ts`:

```typescript
interface PostToolUseConfig {
  matcher: string;
  run: string[];
}

interface SubagentStopConfig {
  verify: string[];
}

interface ReinjectConfig {
  every: number;
  content: string | ((ctx: Context) => string);
}

export class AgentBuilder {
  // ... existing fields
  private _postToolUse?: PostToolUseConfig;
  private _subagentStop?: SubagentStopConfig;
  private _reinject?: ReinjectConfig;

  postToolUse(config: PostToolUseConfig): this {
    this._postToolUse = config;
    return this;
  }

  subagentStop(config: SubagentStopConfig): this {
    this._subagentStop = config;
    return this;
  }

  reinject(config: ReinjectConfig): this {
    this._reinject = config;
    return this;
  }

  build(): CompiledAgent {
    // ... existing build logic
    return {
      // ... existing fields
      postToolUse: this._postToolUse ? {
        matcher: this._postToolUse.matcher,
        commands: this._postToolUse.run,
      } : undefined,
      subagentStop: this._subagentStop ? {
        verify: this._subagentStop.verify,
      } : undefined,
      reinject: this._reinject ? {
        every: this._reinject.every,
        template: typeof this._reinject.content === 'string'
          ? this._reinject.content
          : this._reinject.content.toString(),
      } : undefined,
    };
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/dsl/src/builders/agent.test.ts
```

Expected: PASS (7 passed)

**Step 5: Update CompiledAgent type for reinject** (2 min)

Add to `packages/dsl/src/types/compiled.ts`:

```typescript
export interface CompiledAgent {
  // ... existing
  reinject?: {
    every: number;
    template: string;
  };
}
```

**Step 6: Commit** (30 sec)

```bash
git add packages/dsl/src/builders/agent.ts packages/dsl/src/builders/agent.test.ts packages/dsl/src/types/compiled.ts
git commit -m "feat(dsl): add postToolUse, subagentStop, reinject to AgentBuilder"
```

---

### Task 10: Code Review

**Files:** All files modified in Tasks 1-9

**Step 1: Run full test suite** (2 min)

```bash
pnpm test
```

Expected: All tests pass (150+ tests)

**Step 2: Run type check** (1 min)

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Run lint** (1 min)

```bash
pnpm lint
```

Expected: No errors (or only minor warnings)

**Step 4: Review exports** (2 min)

Verify all new exports are properly listed in package index files:
- `packages/daemon/src/index.ts`
- `packages/dsl/src/index.ts`
- `packages/cli/src/index.ts`

**Step 5: Test CLI commands manually** (3 min)

```bash
# Build packages
pnpm build

# Test verify-complete command
cd /tmp && echo "- [ ] Incomplete" > todo.md
npx hyh verify-complete --todo-file todo.md
# Should exit 1

echo "- [x] Complete" > todo.md
npx hyh verify-complete --todo-file todo.md
# Should exit 0
```

**Step 6: Final commit** (30 sec)

```bash
git add -A
git commit -m "chore: code review and polish for phases 1-3 completion"
```

---

## Parallel Execution Groups

| Group | Tasks | Rationale |
|-------|-------|-----------|
| Group 1 | 1, 2, 3 | Independent checkers, no file overlap |
| Group 2 | 4, 5 | Independent managers, no file overlap |
| Group 3 | 6, 7, 8 | Sequential - share CLI patterns and depend on new checkers |
| Group 4 | 9, 10 | Sequential - DSL changes then review |

---

## Summary

This plan completes Phases 1-3 by implementing:

1. **Runtime Checkers**: TodoChecker, PhaseToolChecker, ContextBudgetChecker
2. **Anti-Abandonment Managers**: ReinjectionManager, ArtifactManager
3. **CLI Commands**: verify-complete
4. **DSL Enhancements**: postToolUse, subagentStop, reinject methods
5. **Hooks Generator**: PostToolUse and SubagentStop hooks

Total: 10 tasks across 4 groups, ~3-4 hours implementation time.
