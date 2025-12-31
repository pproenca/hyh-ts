# Implementation Plan: SPEC-3 Deferred Features

**Date:** 2025-12-31
**Status:** Draft

## Overview

This plan implements 6 features deferred from SPEC-3-VALIDATION.md:

1. `hyh simulate` - Mock agent simulation command
2. `hyh metrics` - Metrics collection and display command
3. Configuration system - `hyh.config.ts` loading
4. MetricsCollector - Token counting, timing metrics
5. RecoveryManager - Crash recovery with session resume
6. DSL extensions - `.scaling()`, `.preCompact()`, `.contextBudget()`

## Architecture Decisions

| Decision | Approach | Rationale |
|----------|----------|-----------|
| MetricsCollector location | `trajectory/metrics.ts` | Colocated with TrajectoryLogger (same data source) |
| RecoveryManager | Methods on StateManager | Recovery is state validation/repair |
| Configuration | `defineConfig()` in DSL | Type-safe, follows Vite/Vitest pattern |
| DSL extensions | Add to existing builders | No new files, follows existing pattern |

## File Map

### New Files (4)

| File | Purpose | Lines |
|------|---------|-------|
| `packages/dsl/src/config.ts` | `defineConfig()` + `HyhConfig` type | ~80 |
| `packages/daemon/src/trajectory/metrics.ts` | MetricsCollector class | ~120 |
| `packages/cli/src/commands/simulate.ts` | Mock agent simulation | ~150 |
| `packages/cli/src/commands/metrics.ts` | Metrics display command | ~80 |

### Modified Files (8)

| File | Changes |
|------|---------|
| `packages/dsl/src/types/compiled.ts` | Add ScalingConfig, PreCompactConfig, contextBudget |
| `packages/dsl/src/builders/workflow.ts` | Add `.scaling()`, `.preCompact()` methods |
| `packages/dsl/src/builders/phase.ts` | Add `.contextBudget()` method |
| `packages/dsl/src/index.ts` | Export defineConfig, HyhConfig |
| `packages/daemon/src/state/manager.ts` | Add recovery methods |
| `packages/daemon/src/index.ts` | Export MetricsCollector |
| `packages/cli/src/commands/run.ts` | Add config loading |
| `packages/cli/src/index.ts` | Register simulate, metrics commands |

---

## Task Groups

Tasks are grouped by file dependencies. Groups execute serially; tasks within a group can run in parallel.

**Group 1:** Tasks 1-3 (DSL types and config - no overlap)
**Group 2:** Tasks 4-5 (DSL builders - workflow.ts and phase.ts)
**Group 3:** Task 6 (Recovery in StateManager)
**Group 4:** Task 7 (MetricsCollector)
**Group 5:** Tasks 8-9 (CLI commands - no overlap)
**Group 6:** Task 10 (Integration wiring)

---

## Tasks

### Task 1: Add CompiledWorkflow/Phase type extensions

**Files:**
- Modify: `packages/dsl/src/types/compiled.ts`
- Test: `packages/dsl/src/types/compiled.test.ts` (create)

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/dsl/src/types/compiled.test.ts
import { describe, it, expect } from 'vitest';
import type { CompiledWorkflow, CompiledPhase, ScalingConfig, PreCompactConfig } from './compiled.js';

describe('CompiledWorkflow extensions', () => {
  it('should accept scaling config', () => {
    const scaling: ScalingConfig = {
      trivial: { maxHours: 1, agents: 1 },
      small: { maxHours: 4, agents: 2 },
    };
    const workflow: Partial<CompiledWorkflow> = { scaling };
    expect(workflow.scaling?.trivial?.maxHours).toBe(1);
  });

  it('should accept preCompact config', () => {
    const preCompact: PreCompactConfig = {
      preserve: ['decisions', 'errors'],
      summarize: ['exploration'],
    };
    const workflow: Partial<CompiledWorkflow> = { preCompact };
    expect(workflow.preCompact?.preserve).toContain('decisions');
  });
});

describe('CompiledPhase extensions', () => {
  it('should accept contextBudget', () => {
    const phase: Partial<CompiledPhase> = { contextBudget: 15000 };
    expect(phase.contextBudget).toBe(15000);
  });
});
```

2. **Run test, verify FAILURE:**
```bash
pnpm --filter @hyh/dsl test -- compiled.test.ts
```
Expected: FAIL (types don't exist yet)

3. **Implement types:**
```typescript
// Add to packages/dsl/src/types/compiled.ts

// Scaling configuration for workflow complexity
export interface ScalingTier {
  maxHours?: number;
  maxDays?: number;
  agents: number;
}

export interface ScalingConfig {
  trivial?: ScalingTier;
  small?: ScalingTier;
  medium?: ScalingTier;
  large?: ScalingTier;
  huge?: ScalingTier;
}

// Pre-compact configuration for context management
export interface PreCompactConfig {
  preserve?: string[];
  summarize?: string[];
  discard?: string[];
}

// Add to CompiledWorkflow interface:
export interface CompiledWorkflow {
  // ... existing fields ...
  scaling?: ScalingConfig;
  preCompact?: PreCompactConfig;
}

// Add to CompiledPhase interface:
export interface CompiledPhase {
  // ... existing fields ...
  contextBudget?: number;
}
```

4. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/dsl test -- compiled.test.ts
```

5. **Commit:**
```bash
git add -A && git commit -m "feat(dsl): add ScalingConfig, PreCompactConfig, contextBudget types"
```

---

### Task 2: Create defineConfig and HyhConfig

**Files:**
- Create: `packages/dsl/src/config.ts`
- Test: `packages/dsl/src/config.test.ts`
- Modify: `packages/dsl/src/index.ts`

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/dsl/src/config.test.ts
import { describe, it, expect } from 'vitest';
import { defineConfig, type HyhConfig } from './config.js';

describe('defineConfig', () => {
  it('should return the config unchanged', () => {
    const config: HyhConfig = {
      daemon: { logLevel: 'debug' },
      claude: { defaultModel: 'sonnet' },
    };
    const result = defineConfig(config);
    expect(result).toEqual(config);
  });

  it('should accept empty config', () => {
    const result = defineConfig({});
    expect(result).toEqual({});
  });

  it('should type-check all config sections', () => {
    const config: HyhConfig = {
      daemon: { socketPath: '/tmp/test.sock', logLevel: 'warn' },
      claude: { defaultModel: 'opus', maxTokens: 4096, timeout: '5m' },
      git: { mainBranch: 'main', autoCommit: false },
    };
    expect(defineConfig(config).daemon?.socketPath).toBe('/tmp/test.sock');
  });
});
```

2. **Run test, verify FAILURE:**
```bash
pnpm --filter @hyh/dsl test -- config.test.ts
```

3. **Implement:**
```typescript
// packages/dsl/src/config.ts

/**
 * Daemon configuration options
 */
export interface DaemonConfig {
  /** Custom socket path (default: ~/.hyh/daemon.sock) */
  socketPath?: string;
  /** State directory (default: .hyh in project root) */
  stateDir?: string;
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Claude model configuration
 */
export interface ClaudeConfig {
  /** Default model for agents */
  defaultModel?: 'sonnet' | 'opus' | 'haiku';
  /** Maximum tokens per request */
  maxTokens?: number;
  /** Request timeout (e.g., '5m', '30s') */
  timeout?: string;
}

/**
 * Git integration configuration
 */
export interface GitConfig {
  /** Main branch name (default: 'main') */
  mainBranch?: string;
  /** Directory for worktrees */
  worktreeDir?: string;
  /** Auto-commit on task completion */
  autoCommit?: boolean;
}

/**
 * Complete hyh configuration
 */
export interface HyhConfig {
  daemon?: DaemonConfig;
  claude?: ClaudeConfig;
  git?: GitConfig;
}

/**
 * Type-safe config definition helper.
 * Use in hyh.config.ts:
 *
 * @example
 * export default defineConfig({
 *   claude: { defaultModel: 'sonnet' }
 * });
 */
export function defineConfig(config: HyhConfig): HyhConfig {
  return config;
}
```

4. **Export from index.ts:**
```typescript
// Add to packages/dsl/src/index.ts
export { defineConfig, type HyhConfig, type DaemonConfig, type ClaudeConfig, type GitConfig } from './config.js';
```

5. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/dsl test -- config.test.ts
```

6. **Commit:**
```bash
git add -A && git commit -m "feat(dsl): add defineConfig and HyhConfig for configuration"
```

---

### Task 3: Export new types from DSL index

**Files:**
- Modify: `packages/dsl/src/index.ts`

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/dsl/src/index.test.ts (add to existing or create)
import { describe, it, expect } from 'vitest';
import * as dsl from './index.js';

describe('DSL exports', () => {
  it('should export ScalingConfig type via CompiledWorkflow', () => {
    // Type check - if this compiles, export works
    const workflow: dsl.CompiledWorkflow = {
      name: 'test',
      resumable: false,
      orchestrator: 'orch',
      agents: {},
      phases: [],
      queues: {},
      gates: {},
      scaling: { small: { maxHours: 2, agents: 1 } },
    };
    expect(workflow.scaling?.small?.agents).toBe(1);
  });

  it('should export defineConfig', () => {
    expect(typeof dsl.defineConfig).toBe('function');
  });
});
```

2. **Run test, verify FAILURE:**
```bash
pnpm --filter @hyh/dsl test -- index.test.ts
```

3. **Implement:**
```typescript
// packages/dsl/src/index.ts - ensure these exports exist
export type { ScalingConfig, ScalingTier, PreCompactConfig } from './types/compiled.js';
export { defineConfig, type HyhConfig, type DaemonConfig, type ClaudeConfig, type GitConfig } from './config.js';
```

4. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/dsl test -- index.test.ts
```

5. **Commit:**
```bash
git add -A && git commit -m "feat(dsl): export ScalingConfig, PreCompactConfig, defineConfig"
```

---

### Task 4: Add .scaling() and .preCompact() to WorkflowBuilder

**Files:**
- Modify: `packages/dsl/src/builders/workflow.ts`
- Test: `packages/dsl/src/builders/workflow.test.ts`

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/dsl/src/builders/workflow.test.ts
import { describe, it, expect } from 'vitest';
import { workflow } from './workflow.js';
import { agent } from './agent.js';

describe('WorkflowBuilder.scaling', () => {
  it('should set scaling config', () => {
    const orch = agent('orch').model('sonnet').role('orchestrator');
    const result = workflow('test')
      .orchestrator(orch)
      .scaling({
        trivial: { maxHours: 1, agents: 1 },
        small: { maxHours: 4, agents: 2 },
      })
      .phase('p1').agent(orch)
      .build();

    expect(result.scaling?.trivial?.maxHours).toBe(1);
    expect(result.scaling?.small?.agents).toBe(2);
  });
});

describe('WorkflowBuilder.preCompact', () => {
  it('should set preCompact config', () => {
    const orch = agent('orch').model('sonnet').role('orchestrator');
    const result = workflow('test')
      .orchestrator(orch)
      .preCompact({
        preserve: ['decisions', 'errors'],
        summarize: ['exploration'],
        discard: ['verbose_logs'],
      })
      .phase('p1').agent(orch)
      .build();

    expect(result.preCompact?.preserve).toContain('decisions');
    expect(result.preCompact?.summarize).toContain('exploration');
    expect(result.preCompact?.discard).toContain('verbose_logs');
  });
});
```

2. **Run test, verify FAILURE:**
```bash
pnpm --filter @hyh/dsl test -- workflow.test.ts
```

3. **Implement:**
```typescript
// Add to packages/dsl/src/builders/workflow.ts

import { CompiledWorkflow, CompiledAgent, CompiledQueue, CompiledGate, ScalingConfig, PreCompactConfig } from '../types/compiled.js';

// Add private fields to WorkflowBuilder class:
private _scaling?: ScalingConfig;
private _preCompact?: PreCompactConfig;

// Add methods:
scaling(config: ScalingConfig): this {
  this._scaling = config;
  return this;
}

preCompact(config: PreCompactConfig): this {
  this._preCompact = config;
  return this;
}

// Update build() to include:
build(): CompiledWorkflow {
  // ... existing code ...

  const result: CompiledWorkflow = {
    name: this._name,
    resumable: this._resumable,
    orchestrator: this._orchestrator?.build().name ?? '',
    agents,
    phases: this._phases.map((p) => p.buildPhase()),
    queues,
    gates,
  };

  if (this._scaling) {
    result.scaling = this._scaling;
  }
  if (this._preCompact) {
    result.preCompact = this._preCompact;
  }

  return result;
}
```

4. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/dsl test -- workflow.test.ts
```

5. **Commit:**
```bash
git add -A && git commit -m "feat(dsl): add .scaling() and .preCompact() to WorkflowBuilder"
```

---

### Task 5: Add .contextBudget() to PhaseBuilder

**Files:**
- Modify: `packages/dsl/src/builders/phase.ts`
- Test: `packages/dsl/src/builders/phase.test.ts`

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/dsl/src/builders/phase.test.ts
import { describe, it, expect } from 'vitest';
import { workflow } from './workflow.js';
import { agent } from './agent.js';

describe('PhaseBuilder.contextBudget', () => {
  it('should set context budget on phase', () => {
    const orch = agent('orch').model('sonnet').role('orchestrator');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('implement')
        .agent(orch)
        .contextBudget(15000)
      .build();

    const phase = result.phases.find(p => p.name === 'implement');
    expect(phase?.contextBudget).toBe(15000);
  });

  it('should allow different budgets per phase', () => {
    const orch = agent('orch').model('sonnet').role('orchestrator');
    const result = workflow('test')
      .orchestrator(orch)
      .phase('plan')
        .agent(orch)
        .contextBudget(10000)
      .phase('implement')
        .agent(orch)
        .contextBudget(20000)
      .build();

    expect(result.phases[0]?.contextBudget).toBe(10000);
    expect(result.phases[1]?.contextBudget).toBe(20000);
  });
});
```

2. **Run test, verify FAILURE:**
```bash
pnpm --filter @hyh/dsl test -- phase.test.ts
```

3. **Implement:**
```typescript
// Add to packages/dsl/src/builders/phase.ts

// Add private field:
private _contextBudget?: number;

// Add method:
contextBudget(tokens: number): this {
  this._contextBudget = tokens;
  return this;
}

// Update buildPhase() to include:
buildPhase(): CompiledPhase {
  const result: CompiledPhase = {
    // ... existing fields ...
  };
  // ... existing conditionals ...
  if (this._contextBudget !== undefined) {
    result.contextBudget = this._contextBudget;
  }
  return result;
}
```

4. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/dsl test -- phase.test.ts
```

5. **Commit:**
```bash
git add -A && git commit -m "feat(dsl): add .contextBudget() to PhaseBuilder"
```

---

### Task 6: Add recovery methods to StateManager

**Files:**
- Modify: `packages/daemon/src/state/manager.ts`
- Test: `packages/daemon/src/state/manager.test.ts`

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/daemon/src/state/manager.test.ts (add to existing)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { StateManager } from './manager.js';
import { TaskStatus, WorkflowState } from '../types/state.js';

describe('StateManager.recoverFromCrash', () => {
  let tempDir: string;
  let manager: StateManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));
    manager = new StateManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should return null state when no state file exists', async () => {
    const result = await manager.recoverFromCrash();
    expect(result.state).toBeNull();
    expect(result.repaired).toEqual([]);
  });

  it('should detect orphaned running tasks with stale timestamps', async () => {
    const staleTime = Date.now() - 700_000; // 700 seconds ago (> 600s timeout)
    const state: WorkflowState = {
      workflowId: 'test',
      workflowName: 'test',
      startedAt: staleTime,
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'task-1': {
          id: 'task-1',
          name: 'Orphaned task',
          status: TaskStatus.RUNNING,
          dependencies: [],
          timeoutSeconds: 600,
          claimedBy: 'dead-worker',
          startedAt: staleTime,
          claimedAt: staleTime,
        },
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };
    await manager.save(state);

    const result = await manager.recoverFromCrash();

    expect(result.repaired.length).toBeGreaterThan(0);
    expect(result.repaired[0]?.type).toBe('orphaned_task');
    expect(result.state?.tasks['task-1']?.status).toBe(TaskStatus.PENDING);
    expect(result.state?.tasks['task-1']?.claimedBy).toBeUndefined();
  });

  it('should not modify healthy running tasks', async () => {
    const recentTime = Date.now() - 30_000; // 30 seconds ago
    const state: WorkflowState = {
      workflowId: 'test',
      workflowName: 'test',
      startedAt: recentTime,
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'task-1': {
          id: 'task-1',
          name: 'Active task',
          status: TaskStatus.RUNNING,
          dependencies: [],
          timeoutSeconds: 600,
          claimedBy: 'active-worker',
          startedAt: recentTime,
          claimedAt: recentTime,
        },
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };
    await manager.save(state);

    const result = await manager.recoverFromCrash();

    expect(result.repaired).toEqual([]);
    expect(result.state?.tasks['task-1']?.status).toBe(TaskStatus.RUNNING);
  });
});
```

2. **Run test, verify FAILURE:**
```bash
pnpm --filter @hyh/daemon test -- manager.test.ts
```

3. **Implement:**
```typescript
// Add to packages/daemon/src/state/manager.ts

export interface StateIssue {
  type: 'orphaned_task' | 'stale_agent' | 'invalid_reference';
  taskId?: string;
  agentId?: string;
  message: string;
}

export interface RecoveryResult {
  state: WorkflowState | null;
  repaired: StateIssue[];
}

// Add to StateManager class:

async recoverFromCrash(): Promise<RecoveryResult> {
  return this.mutex.runExclusive(async () => {
    const state = await this.loadInternal();
    if (!state) {
      return { state: null, repaired: [] };
    }

    const issues = this.validateStateInternal(state);
    if (issues.length === 0) {
      return { state, repaired: [] };
    }

    const repairedState = this.repairStateInternal(state, issues);
    await this.saveInternal(repairedState);

    return { state: repairedState, repaired: issues };
  });
}

private validateStateInternal(state: WorkflowState): StateIssue[] {
  const issues: StateIssue[] = [];
  const now = Date.now();

  // Check for orphaned running tasks (stale timestamps)
  for (const [taskId, task] of Object.entries(state.tasks)) {
    if (task.status === TaskStatus.RUNNING && task.startedAt) {
      const elapsed = now - task.startedAt;
      if (elapsed > task.timeoutSeconds * 1000) {
        issues.push({
          type: 'orphaned_task',
          taskId,
          message: `Task ${taskId} timed out (${Math.floor(elapsed / 1000)}s > ${task.timeoutSeconds}s)`,
        });
      }
    }
  }

  return issues;
}

private repairStateInternal(state: WorkflowState, issues: StateIssue[]): WorkflowState {
  const newTasks = { ...state.tasks };

  for (const issue of issues) {
    if (issue.type === 'orphaned_task' && issue.taskId) {
      const task = newTasks[issue.taskId];
      if (task) {
        newTasks[issue.taskId] = {
          ...task,
          status: TaskStatus.PENDING,
          claimedBy: undefined,
          startedAt: undefined,
          claimedAt: undefined,
        };
      }
    }
  }

  return { ...state, tasks: newTasks };
}
```

4. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/daemon test -- manager.test.ts
```

5. **Commit:**
```bash
git add -A && git commit -m "feat(daemon): add recoverFromCrash to StateManager"
```

---

### Task 7: Create MetricsCollector

**Files:**
- Create: `packages/daemon/src/trajectory/metrics.ts`
- Test: `packages/daemon/src/trajectory/metrics.test.ts`
- Modify: `packages/daemon/src/index.ts`

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/daemon/src/trajectory/metrics.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector, WorkflowMetrics } from './metrics.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('recordTaskComplete', () => {
    it('should track completed task count', () => {
      collector.recordTaskComplete('task-1', 5000);
      collector.recordTaskComplete('task-2', 3000);

      const metrics = collector.export();
      expect(metrics.tasksCompleted).toBe(2);
    });

    it('should track task durations', () => {
      collector.recordTaskComplete('task-1', 5000);
      collector.recordTaskComplete('task-2', 3000);

      const metrics = collector.export();
      expect(metrics.taskDurations['task-1']).toBe(5000);
      expect(metrics.taskDurations['task-2']).toBe(3000);
    });
  });

  describe('recordTaskFailed', () => {
    it('should track failed task count', () => {
      collector.recordTaskFailed('task-1');

      const metrics = collector.export();
      expect(metrics.tasksFailed).toBe(1);
    });
  });

  describe('recordViolation', () => {
    it('should count violations by type', () => {
      collector.recordViolation('tdd');
      collector.recordViolation('tdd');
      collector.recordViolation('file-scope');

      const metrics = collector.export();
      expect(metrics.violationCount['tdd']).toBe(2);
      expect(metrics.violationCount['file-scope']).toBe(1);
    });
  });

  describe('recordCorrection', () => {
    it('should count corrections by type', () => {
      collector.recordCorrection('prompt');
      collector.recordCorrection('restart');
      collector.recordCorrection('prompt');

      const metrics = collector.export();
      expect(metrics.correctionCount['prompt']).toBe(2);
      expect(metrics.correctionCount['restart']).toBe(1);
    });
  });

  describe('recordTokens', () => {
    it('should accumulate token estimates', () => {
      collector.recordTokens(1000);
      collector.recordTokens(500);

      const metrics = collector.export();
      expect(metrics.estimatedTokensUsed).toBe(1500);
    });
  });

  describe('export', () => {
    it('should calculate total duration', async () => {
      collector.recordTaskComplete('task-1', 100);
      await new Promise(r => setTimeout(r, 50));

      const metrics = collector.export();
      expect(metrics.totalDuration).toBeGreaterThanOrEqual(50);
    });
  });
});
```

2. **Run test, verify FAILURE:**
```bash
pnpm --filter @hyh/daemon test -- metrics.test.ts
```

3. **Implement:**
```typescript
// packages/daemon/src/trajectory/metrics.ts

export interface WorkflowMetrics {
  totalDuration: number;
  phaseDurations: Record<string, number>;
  taskDurations: Record<string, number>;
  tasksCompleted: number;
  tasksFailed: number;
  tasksRetried: number;
  violationCount: Record<string, number>;
  correctionCount: Record<string, number>;
  humanInterventions: number;
  agentSpawns: number;
  estimatedTokensUsed: number;
}

export class MetricsCollector {
  private readonly startTime: number;
  private tasksCompleted = 0;
  private tasksFailed = 0;
  private tasksRetried = 0;
  private humanInterventions = 0;
  private agentSpawns = 0;
  private estimatedTokensUsed = 0;
  private readonly taskDurations: Record<string, number> = {};
  private readonly phaseDurations: Record<string, number> = {};
  private readonly violationCount: Record<string, number> = {};
  private readonly correctionCount: Record<string, number> = {};

  constructor() {
    this.startTime = Date.now();
  }

  recordTaskComplete(taskId: string, durationMs: number): void {
    this.tasksCompleted++;
    this.taskDurations[taskId] = durationMs;
  }

  recordTaskFailed(taskId: string): void {
    this.tasksFailed++;
  }

  recordTaskRetry(taskId: string): void {
    this.tasksRetried++;
  }

  recordViolation(type: string): void {
    this.violationCount[type] = (this.violationCount[type] ?? 0) + 1;
  }

  recordCorrection(type: string): void {
    this.correctionCount[type] = (this.correctionCount[type] ?? 0) + 1;
  }

  recordHumanIntervention(): void {
    this.humanInterventions++;
  }

  recordAgentSpawn(): void {
    this.agentSpawns++;
  }

  recordTokens(count: number): void {
    this.estimatedTokensUsed += count;
  }

  recordPhaseTime(phase: string, durationMs: number): void {
    this.phaseDurations[phase] = (this.phaseDurations[phase] ?? 0) + durationMs;
  }

  export(): WorkflowMetrics {
    return {
      totalDuration: Date.now() - this.startTime,
      phaseDurations: { ...this.phaseDurations },
      taskDurations: { ...this.taskDurations },
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      tasksRetried: this.tasksRetried,
      violationCount: { ...this.violationCount },
      correctionCount: { ...this.correctionCount },
      humanInterventions: this.humanInterventions,
      agentSpawns: this.agentSpawns,
      estimatedTokensUsed: this.estimatedTokensUsed,
    };
  }
}
```

4. **Export from daemon index:**
```typescript
// Add to packages/daemon/src/index.ts
export { MetricsCollector, type WorkflowMetrics } from './trajectory/metrics.js';
```

5. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/daemon test -- metrics.test.ts
```

6. **Commit:**
```bash
git add -A && git commit -m "feat(daemon): add MetricsCollector for workflow metrics"
```

---

### Task 8: Create hyh simulate command

**Files:**
- Create: `packages/cli/src/commands/simulate.ts`
- Test: `packages/cli/src/commands/simulate.test.ts`
- Modify: `packages/cli/src/index.ts`

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/cli/src/commands/simulate.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerSimulateCommand } from './simulate.js';

describe('hyh simulate', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerSimulateCommand(program);
    vi.clearAllMocks();
  });

  it('should register simulate command', () => {
    const cmd = program.commands.find((c) => c.name() === 'simulate');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('simulation');
  });

  it('should accept workflow file argument', () => {
    const cmd = program.commands.find((c) => c.name() === 'simulate');
    expect(cmd?.args).toBeDefined();
  });

  it('should accept --speed option', () => {
    const cmd = program.commands.find((c) => c.name() === 'simulate');
    const speedOpt = cmd?.options.find((o) => o.long === '--speed');
    expect(speedOpt).toBeDefined();
  });

  it('should accept --seed option', () => {
    const cmd = program.commands.find((c) => c.name() === 'simulate');
    const seedOpt = cmd?.options.find((o) => o.long === '--seed');
    expect(seedOpt).toBeDefined();
  });
});
```

2. **Run test, verify FAILURE:**
```bash
pnpm --filter @hyh/cli test -- simulate.test.ts
```

3. **Implement:**
```typescript
// packages/cli/src/commands/simulate.ts
import { Command } from 'commander';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CompiledWorkflow } from '@hyh/dsl';
import { MetricsCollector } from '@hyh/daemon';

interface SimulateOptions {
  speed: string;
  seed?: string;
  verbose: boolean;
}

interface MockAgentEvent {
  type: 'tool_use' | 'task_complete' | 'violation' | 'correction';
  agentId: string;
  data: Record<string, unknown>;
}

class MockAgent {
  constructor(
    private readonly name: string,
    private readonly speed: number,
    private readonly seed: number
  ) {}

  async *run(): AsyncGenerator<MockAgentEvent> {
    const random = this.seededRandom(this.seed);
    const toolCount = Math.floor(random() * 5) + 1;

    for (let i = 0; i < toolCount; i++) {
      await this.delay(100 / this.speed);
      yield {
        type: 'tool_use',
        agentId: this.name,
        data: { tool: `tool_${i}`, input: 'mock input' },
      };
    }

    // Random chance of violation
    if (random() < 0.2) {
      yield {
        type: 'violation',
        agentId: this.name,
        data: { invariant: 'tdd' },
      };
    }

    await this.delay(50 / this.speed);
    yield {
      type: 'task_complete',
      agentId: this.name,
      data: { success: true },
    };
  }

  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function registerSimulateCommand(program: Command): void {
  program
    .command('simulate')
    .description('Run workflow simulation with mock agents')
    .argument('<workflow>', 'Path to workflow.ts file')
    .option('-s, --speed <multiplier>', 'Simulation speed multiplier', '1')
    .option('--seed <number>', 'Random seed for reproducibility')
    .option('-v, --verbose', 'Show detailed event log', false)
    .action(async (workflowPath: string, options: SimulateOptions) => {
      try {
        const fullPath = path.resolve(process.cwd(), workflowPath);
        const { default: workflow } = (await import(pathToFileURL(fullPath).href)) as {
          default: CompiledWorkflow;
        };

        const speed = parseFloat(options.speed);
        const seed = options.seed ? parseInt(options.seed, 10) : Date.now();
        const metrics = new MetricsCollector();

        console.log(`Simulating workflow: ${workflow.name}`);
        console.log(`Speed: ${speed}x, Seed: ${seed}`);
        console.log('---');

        for (const [agentName] of Object.entries(workflow.agents)) {
          const agent = new MockAgent(agentName, speed, seed);

          for await (const event of agent.run()) {
            if (options.verbose) {
              console.log(`[${event.agentId}] ${event.type}:`, event.data);
            }

            switch (event.type) {
              case 'task_complete':
                metrics.recordTaskComplete(agentName, 1000);
                break;
              case 'violation':
                metrics.recordViolation(event.data.invariant as string);
                break;
              case 'tool_use':
                metrics.recordTokens(100); // Estimate
                break;
            }
          }
        }

        const summary = metrics.export();
        console.log('---');
        console.log('Simulation complete:');
        console.log(`  Tasks completed: ${summary.tasksCompleted}`);
        console.log(`  Violations: ${Object.values(summary.violationCount).reduce((a, b) => a + b, 0)}`);
        console.log(`  Estimated tokens: ${summary.estimatedTokensUsed}`);
        console.log(`  Duration: ${summary.totalDuration}ms`);
      } catch (error) {
        console.error('Simulation failed:', error);
        process.exit(1);
      }
    });
}
```

4. **Register in index.ts:**
```typescript
// Add to packages/cli/src/index.ts
import { registerSimulateCommand } from './commands/simulate.js';
// In main():
registerSimulateCommand(program);
```

5. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/cli test -- simulate.test.ts
```

6. **Commit:**
```bash
git add -A && git commit -m "feat(cli): add hyh simulate command for mock agent testing"
```

---

### Task 9: Create hyh metrics command

**Files:**
- Create: `packages/cli/src/commands/metrics.ts`
- Test: `packages/cli/src/commands/metrics.test.ts`
- Modify: `packages/cli/src/index.ts`

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/cli/src/commands/metrics.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerMetricsCommand } from './metrics.js';

describe('hyh metrics', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerMetricsCommand(program);
    vi.clearAllMocks();
  });

  it('should register metrics command', () => {
    const cmd = program.commands.find((c) => c.name() === 'metrics');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('metrics');
  });

  it('should accept --format option', () => {
    const cmd = program.commands.find((c) => c.name() === 'metrics');
    const formatOpt = cmd?.options.find((o) => o.long === '--format');
    expect(formatOpt).toBeDefined();
  });

  it('should accept --output option', () => {
    const cmd = program.commands.find((c) => c.name() === 'metrics');
    const outputOpt = cmd?.options.find((o) => o.long === '--output');
    expect(outputOpt).toBeDefined();
  });
});
```

2. **Run test, verify FAILURE:**
```bash
pnpm --filter @hyh/cli test -- metrics.test.ts
```

3. **Implement:**
```typescript
// packages/cli/src/commands/metrics.ts
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { WorkflowMetrics } from '@hyh/daemon';

interface MetricsOptions {
  format: 'json' | 'table' | 'prometheus';
  output?: string;
}

function formatAsTable(metrics: WorkflowMetrics): string {
  const lines: string[] = [];
  lines.push('Workflow Metrics');
  lines.push('================');
  lines.push(`Total Duration: ${(metrics.totalDuration / 1000).toFixed(1)}s`);
  lines.push(`Tasks Completed: ${metrics.tasksCompleted}`);
  lines.push(`Tasks Failed: ${metrics.tasksFailed}`);
  lines.push(`Tasks Retried: ${metrics.tasksRetried}`);
  lines.push(`Human Interventions: ${metrics.humanInterventions}`);
  lines.push(`Agent Spawns: ${metrics.agentSpawns}`);
  lines.push(`Estimated Tokens: ${metrics.estimatedTokensUsed.toLocaleString()}`);

  if (Object.keys(metrics.violationCount).length > 0) {
    lines.push('');
    lines.push('Violations:');
    for (const [type, count] of Object.entries(metrics.violationCount)) {
      lines.push(`  ${type}: ${count}`);
    }
  }

  if (Object.keys(metrics.correctionCount).length > 0) {
    lines.push('');
    lines.push('Corrections:');
    for (const [type, count] of Object.entries(metrics.correctionCount)) {
      lines.push(`  ${type}: ${count}`);
    }
  }

  return lines.join('\n');
}

function formatAsPrometheus(metrics: WorkflowMetrics): string {
  const lines: string[] = [];
  lines.push('# HELP hyh_workflow_duration_seconds Total workflow duration');
  lines.push('# TYPE hyh_workflow_duration_seconds gauge');
  lines.push(`hyh_workflow_duration_seconds ${metrics.totalDuration / 1000}`);

  lines.push('# HELP hyh_tasks_completed_total Total tasks completed');
  lines.push('# TYPE hyh_tasks_completed_total counter');
  lines.push(`hyh_tasks_completed_total ${metrics.tasksCompleted}`);

  lines.push('# HELP hyh_tasks_failed_total Total tasks failed');
  lines.push('# TYPE hyh_tasks_failed_total counter');
  lines.push(`hyh_tasks_failed_total ${metrics.tasksFailed}`);

  lines.push('# HELP hyh_tokens_used_total Estimated tokens used');
  lines.push('# TYPE hyh_tokens_used_total counter');
  lines.push(`hyh_tokens_used_total ${metrics.estimatedTokensUsed}`);

  for (const [type, count] of Object.entries(metrics.violationCount)) {
    lines.push(`hyh_violations_total{type="${type}"} ${count}`);
  }

  return lines.join('\n');
}

export function registerMetricsCommand(program: Command): void {
  program
    .command('metrics')
    .description('Display workflow metrics')
    .option('-f, --format <format>', 'Output format: json, table, prometheus', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .action(async (options: MetricsOptions) => {
      try {
        const stateDir = path.join(process.cwd(), '.hyh');
        const metricsFile = path.join(stateDir, 'metrics.json');

        let metrics: WorkflowMetrics;
        try {
          const content = await fs.readFile(metricsFile, 'utf-8');
          metrics = JSON.parse(content) as WorkflowMetrics;
        } catch {
          // Default empty metrics if file doesn't exist
          metrics = {
            totalDuration: 0,
            phaseDurations: {},
            taskDurations: {},
            tasksCompleted: 0,
            tasksFailed: 0,
            tasksRetried: 0,
            violationCount: {},
            correctionCount: {},
            humanInterventions: 0,
            agentSpawns: 0,
            estimatedTokensUsed: 0,
          };
        }

        let output: string;
        switch (options.format) {
          case 'json':
            output = JSON.stringify(metrics, null, 2);
            break;
          case 'prometheus':
            output = formatAsPrometheus(metrics);
            break;
          case 'table':
          default:
            output = formatAsTable(metrics);
            break;
        }

        if (options.output) {
          await fs.writeFile(options.output, output);
          console.log(`Metrics written to ${options.output}`);
        } else {
          console.log(output);
        }
      } catch (error) {
        console.error('Failed to display metrics:', error);
        process.exit(1);
      }
    });
}
```

4. **Register in index.ts:**
```typescript
// Add to packages/cli/src/index.ts
import { registerMetricsCommand } from './commands/metrics.js';
// In main():
registerMetricsCommand(program);
```

5. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/cli test -- metrics.test.ts
```

6. **Commit:**
```bash
git add -A && git commit -m "feat(cli): add hyh metrics command for metrics display"
```

---

### Task 10: Add config loading to run command

**Files:**
- Modify: `packages/cli/src/commands/run.ts`
- Test: `packages/cli/src/commands/run.test.ts` (add config tests)

**TDD Instructions:**

1. **Write test FIRST:**
```typescript
// packages/cli/src/commands/run.test.ts (add to existing)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';
import { registerRunCommand } from './run.js';

describe('hyh run config loading', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerRunCommand(program);
  });

  it('should accept --config option', () => {
    const cmd = program.commands.find((c) => c.name() === 'run');
    const configOpt = cmd?.options.find((o) => o.long === '--config');
    expect(configOpt).toBeDefined();
  });
});
```

2. **Run test, verify current state (may pass or fail):**
```bash
pnpm --filter @hyh/cli test -- run.test.ts
```

3. **Implement config loading:**
```typescript
// Modify packages/cli/src/commands/run.ts

import type { HyhConfig } from '@hyh/dsl';
import { pathToFileURL } from 'node:url';

interface RunOptions {
  config?: string;
  // ... existing options
}

async function loadConfig(projectDir: string, configPath?: string): Promise<HyhConfig> {
  const configFile = configPath
    ? path.resolve(projectDir, configPath)
    : path.join(projectDir, 'hyh.config.ts');

  try {
    const { default: config } = await import(pathToFileURL(configFile).href);
    return config as HyhConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      return {}; // No config file, use defaults
    }
    throw error;
  }
}

// In registerRunCommand, add option:
.option('-c, --config <path>', 'Path to config file')

// In action handler, before creating daemon:
const config = await loadConfig(process.cwd(), options.config);
if (config.daemon?.logLevel) {
  console.log(`Log level: ${config.daemon.logLevel}`);
}
// Pass config to daemon when initializing
```

4. **Run test, verify PASS:**
```bash
pnpm --filter @hyh/cli test -- run.test.ts
```

5. **Commit:**
```bash
git add -A && git commit -m "feat(cli): add config loading to run command"
```

---

## Verification

After all tasks complete:

```bash
# Run all tests
pnpm test

# Build all packages
pnpm build

# Type check
pnpm typecheck
```

## Summary

| Task | Feature | Files |
|------|---------|-------|
| 1 | CompiledWorkflow type extensions | compiled.ts |
| 2 | defineConfig + HyhConfig | config.ts |
| 3 | DSL exports | index.ts |
| 4 | .scaling(), .preCompact() | workflow.ts |
| 5 | .contextBudget() | phase.ts |
| 6 | Recovery methods | manager.ts |
| 7 | MetricsCollector | metrics.ts |
| 8 | hyh simulate | simulate.ts |
| 9 | hyh metrics | metrics.ts |
| 10 | Config loading | run.ts |

**Total:** 4 new files, 8 modified files, ~10 tasks
