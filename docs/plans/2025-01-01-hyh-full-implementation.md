# HYH TypeScript Full Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-hyh-full-implementation.md` to implement task-by-task.

**Goal:** Complete the hyh TypeScript port from current foundation (Phase 1-2 partial) through Phase 6 (production-ready).

**Architecture:** Monorepo with 4 packages (@hyh/dsl, @hyh/daemon, @hyh/cli, @hyh/tui). DSL compiles to JSON workflow definitions. Daemon manages state, spawns Claude CLI agents, enforces invariants. TUI provides real-time observability via IPC.

**Tech Stack:** TypeScript, pnpm workspaces, Vitest, Zod, Commander.js, Ink (React for CLI), Unix sockets IPC.

**Current Status:**
- DSL: 95% complete (builders, invariants, corrections, compiler)
- Daemon: 60% complete (core, state, trajectory, IPC, checkers, agent process)
- CLI: 40% complete (compile, status, task claim/complete)
- TUI: 0% (not started)

---

## Phase 2: Daemon Core Completion

### Task 1: Workflow Loader

**Files:**
- Create: `packages/daemon/src/workflow/loader.ts`
- Create: `packages/daemon/src/workflow/loader.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/workflow/loader.test.ts
import { describe, it, expect } from 'vitest';
import { WorkflowLoader } from './loader.js';

describe('WorkflowLoader', () => {
  it('loads compiled workflow from .hyh/workflow.json', async () => {
    const loader = new WorkflowLoader('/tmp/test-project');
    // Arrange: create .hyh/workflow.json with minimal valid workflow
    // Act
    const workflow = await loader.load();
    // Assert
    expect(workflow.name).toBe('test-workflow');
    expect(workflow.phases).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/workflow/loader.test.ts
```

Expected: FAIL with "Cannot find module './loader.js'"

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/workflow/loader.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CompiledWorkflow } from '@hyh/dsl';

export class WorkflowLoader {
  private readonly workflowPath: string;

  constructor(worktreeRoot: string) {
    this.workflowPath = path.join(worktreeRoot, '.hyh', 'workflow.json');
  }

  async load(): Promise<CompiledWorkflow> {
    const content = await fs.readFile(this.workflowPath, 'utf-8');
    return JSON.parse(content) as CompiledWorkflow;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.workflowPath);
      return true;
    } catch {
      return false;
    }
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/workflow/loader.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/workflow/
git commit -m "feat(daemon): add WorkflowLoader for loading compiled workflows"
```

---

### Task 2: Event Loop Core

**Files:**
- Create: `packages/daemon/src/core/event-loop.ts`
- Create: `packages/daemon/src/core/event-loop.test.ts`
- Modify: `packages/daemon/src/core/daemon.ts:40-50`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/core/event-loop.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventLoop } from './event-loop.js';

describe('EventLoop', () => {
  it('runs tick cycle and can be stopped', async () => {
    const onTick = vi.fn();
    const loop = new EventLoop({ tickInterval: 10, onTick });

    loop.start();
    await new Promise(r => setTimeout(r, 50));
    loop.stop();

    expect(onTick).toHaveBeenCalled();
    expect(loop.isRunning).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/core/event-loop.test.ts
```

Expected: FAIL with "Cannot find module './event-loop.js'"

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/core/event-loop.ts
export interface EventLoopOptions {
  tickInterval: number;
  onTick: () => Promise<void> | void;
}

export class EventLoop {
  private readonly options: EventLoopOptions;
  private timer: NodeJS.Timeout | null = null;
  private _isRunning = false;

  constructor(options: EventLoopOptions) {
    this.options = options;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this.scheduleTick();
  }

  stop(): void {
    this._isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private scheduleTick(): void {
    if (!this._isRunning) return;
    this.timer = setTimeout(async () => {
      try {
        await this.options.onTick();
      } finally {
        this.scheduleTick();
      }
    }, this.options.tickInterval);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/core/event-loop.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/event-loop.ts packages/daemon/src/core/event-loop.test.ts
git commit -m "feat(daemon): add EventLoop for main processing cycle"
```

---

### Task 3: Phase Transition Manager

**Files:**
- Create: `packages/daemon/src/workflow/phase-manager.ts`
- Create: `packages/daemon/src/workflow/phase-manager.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/workflow/phase-manager.test.ts
import { describe, it, expect } from 'vitest';
import { PhaseManager } from './phase-manager.js';

describe('PhaseManager', () => {
  it('determines if phase can transition based on outputs', () => {
    const manager = new PhaseManager({
      phases: [
        { name: 'explore', outputs: ['architecture.md'] },
        { name: 'implement', requires: ['architecture.md'] },
      ],
    });

    expect(manager.canTransition('explore', 'implement', {
      artifacts: ['architecture.md'],
    })).toBe(true);
  });

  it('blocks transition when outputs missing', () => {
    const manager = new PhaseManager({
      phases: [
        { name: 'explore', outputs: ['architecture.md'] },
        { name: 'implement', requires: ['architecture.md'] },
      ],
    });

    expect(manager.canTransition('explore', 'implement', {
      artifacts: [],
    })).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/workflow/phase-manager.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/workflow/phase-manager.ts
import type { CompiledPhase } from '@hyh/dsl';

interface PhaseManagerConfig {
  phases: Array<Partial<CompiledPhase>>;
}

interface TransitionContext {
  artifacts: string[];
  queueEmpty?: boolean;
  checkpointPassed?: boolean;
}

export class PhaseManager {
  private readonly phases: Map<string, Partial<CompiledPhase>>;
  private readonly phaseOrder: string[];

  constructor(config: PhaseManagerConfig) {
    this.phases = new Map();
    this.phaseOrder = [];
    for (const phase of config.phases) {
      if (phase.name) {
        this.phases.set(phase.name, phase);
        this.phaseOrder.push(phase.name);
      }
    }
  }

  canTransition(from: string, to: string, context: TransitionContext): boolean {
    const toPhase = this.phases.get(to);
    if (!toPhase) return false;

    // Check requires artifacts exist
    const requires = (toPhase as any).requires || [];
    for (const req of requires) {
      if (!context.artifacts.includes(req)) {
        return false;
      }
    }

    return true;
  }

  getNextPhase(current: string): string | null {
    const idx = this.phaseOrder.indexOf(current);
    if (idx === -1 || idx >= this.phaseOrder.length - 1) return null;
    return this.phaseOrder[idx + 1];
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/workflow/phase-manager.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/workflow/
git commit -m "feat(daemon): add PhaseManager for phase transition logic"
```

---

### Task 4: NoCode Checker

**Files:**
- Create: `packages/daemon/src/checkers/no-code.ts`
- Create: `packages/daemon/src/checkers/no-code.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/checkers/no-code.test.ts
import { describe, it, expect } from 'vitest';
import { NoCodeChecker } from './no-code.js';

describe('NoCodeChecker', () => {
  it('allows Read operations', () => {
    const checker = new NoCodeChecker('orchestrator');
    const violation = checker.check({
      type: 'tool_use',
      tool: 'Read',
      timestamp: Date.now(),
    }, { agentId: 'orchestrator', event: {}, state: {} });

    expect(violation).toBeNull();
  });

  it('blocks Write to code files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const violation = checker.check({
      type: 'tool_use',
      tool: 'Write',
      path: 'src/foo.ts',
      timestamp: Date.now(),
    }, { agentId: 'orchestrator', event: {}, state: {} });

    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('noCode');
  });

  it('allows Write to markdown files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const violation = checker.check({
      type: 'tool_use',
      tool: 'Write',
      path: 'docs/plan.md',
      timestamp: Date.now(),
    }, { agentId: 'orchestrator', event: {}, state: {} });

    expect(violation).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/checkers/no-code.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/checkers/no-code.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';

const CODE_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h'];

export class NoCodeChecker implements Checker {
  private readonly agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  appliesTo(agentId: string, _state: unknown): boolean {
    return agentId === this.agentId;
  }

  check(event: TrajectoryEvent, _context: CheckContext): Violation | null {
    if (event.type !== 'tool_use') return null;

    const tool = (event as any).tool;
    if (tool !== 'Write' && tool !== 'Edit') return null;

    const path = (event as any).path as string | undefined;
    if (!path) return null;

    const isCodeFile = CODE_EXTENSIONS.some(ext => path.endsWith(ext));
    if (isCodeFile) {
      return {
        type: 'noCode',
        message: `Code modification not allowed: ${path}`,
        agentId: this.agentId,
      };
    }

    return null;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/checkers/no-code.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/checkers/no-code.ts packages/daemon/src/checkers/no-code.test.ts
git commit -m "feat(daemon): add NoCodeChecker invariant"
```

---

### Task 5: MustProgress Checker

**Files:**
- Create: `packages/daemon/src/checkers/must-progress.ts`
- Create: `packages/daemon/src/checkers/must-progress.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/checkers/must-progress.test.ts
import { describe, it, expect } from 'vitest';
import { MustProgressChecker } from './must-progress.js';

describe('MustProgressChecker', () => {
  it('allows activity within timeout', () => {
    const checker = new MustProgressChecker('worker', 60000);
    checker.recordActivity();

    const violation = checker.checkTimeout();
    expect(violation).toBeNull();
  });

  it('detects timeout after inactivity', () => {
    const checker = new MustProgressChecker('worker', 100);
    // Simulate time passing without activity
    checker['lastActivity'] = Date.now() - 200;

    const violation = checker.checkTimeout();
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('mustProgress');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/checkers/must-progress.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/checkers/must-progress.ts
import type { Checker, Violation, CheckContext, TrajectoryEvent } from './types.js';

export class MustProgressChecker implements Checker {
  private readonly agentId: string;
  private readonly timeoutMs: number;
  private lastActivity: number;

  constructor(agentId: string, timeoutMs: number) {
    this.agentId = agentId;
    this.timeoutMs = timeoutMs;
    this.lastActivity = Date.now();
  }

  appliesTo(agentId: string, _state: unknown): boolean {
    return agentId === this.agentId;
  }

  recordActivity(): void {
    this.lastActivity = Date.now();
  }

  check(event: TrajectoryEvent, _context: CheckContext): Violation | null {
    // Any tool use counts as progress
    if (event.type === 'tool_use') {
      this.recordActivity();
    }
    return null;
  }

  checkTimeout(): Violation | null {
    const elapsed = Date.now() - this.lastActivity;
    if (elapsed > this.timeoutMs) {
      return {
        type: 'mustProgress',
        message: `No progress for ${Math.round(elapsed / 1000)}s (timeout: ${Math.round(this.timeoutMs / 1000)}s)`,
        agentId: this.agentId,
      };
    }
    return null;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/checkers/must-progress.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/checkers/must-progress.ts packages/daemon/src/checkers/must-progress.test.ts
git commit -m "feat(daemon): add MustProgressChecker invariant"
```

---

### Task 6: Correction Applicator

**Files:**
- Create: `packages/daemon/src/corrections/applicator.ts`
- Create: `packages/daemon/src/corrections/applicator.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/corrections/applicator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CorrectionApplicator } from './applicator.js';

describe('CorrectionApplicator', () => {
  it('applies prompt correction by injecting message', async () => {
    const injectPrompt = vi.fn();
    const applicator = new CorrectionApplicator({ injectPrompt });

    await applicator.apply('worker-1', {
      type: 'prompt',
      message: 'Write tests first.',
    });

    expect(injectPrompt).toHaveBeenCalledWith('worker-1', expect.stringContaining('Write tests first'));
  });

  it('applies block correction', async () => {
    const injectPrompt = vi.fn();
    const applicator = new CorrectionApplicator({ injectPrompt });

    const result = await applicator.apply('worker-1', {
      type: 'block',
      message: 'Action blocked',
    });

    expect(result.blocked).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/corrections/applicator.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/corrections/applicator.ts
import type { Correction } from '@hyh/dsl';

interface ApplicatorDeps {
  injectPrompt: (agentId: string, message: string) => Promise<void>;
  killAgent?: (agentId: string) => Promise<void>;
  reassignTask?: (agentId: string) => Promise<void>;
}

interface ApplyResult {
  blocked: boolean;
  message?: string;
}

export class CorrectionApplicator {
  private readonly deps: ApplicatorDeps;

  constructor(deps: ApplicatorDeps) {
    this.deps = deps;
  }

  async apply(agentId: string, correction: Correction): Promise<ApplyResult> {
    switch (correction.type) {
      case 'prompt':
        await this.deps.injectPrompt(agentId, `<correction>\n${correction.message}\n</correction>`);
        return { blocked: false };

      case 'warn':
        // Just log, don't block
        console.warn(`[${agentId}] Warning: ${correction.message}`);
        return { blocked: false };

      case 'block':
        await this.deps.injectPrompt(agentId, `<blocked>\n${correction.message}\n</blocked>`);
        return { blocked: true, message: correction.message };

      case 'restart':
        if (this.deps.killAgent) {
          await this.deps.killAgent(agentId);
        }
        return { blocked: true, message: 'Agent restarted' };

      case 'reassign':
        if (this.deps.reassignTask) {
          await this.deps.reassignTask(agentId);
        }
        return { blocked: true, message: 'Task reassigned' };

      case 'escalate':
        // Log escalation, will be handled by daemon
        return { blocked: false, message: `Escalated to ${correction.to}` };

      default:
        return { blocked: false };
    }
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/corrections/applicator.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/corrections/
git commit -m "feat(daemon): add CorrectionApplicator for invariant corrections"
```

---

## Phase 3: Agent Management

### Task 7: Spawn Trigger Manager

**Files:**
- Create: `packages/daemon/src/workflow/spawn-trigger.ts`
- Create: `packages/daemon/src/workflow/spawn-trigger.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/workflow/spawn-trigger.test.ts
import { describe, it, expect } from 'vitest';
import { SpawnTriggerManager } from './spawn-trigger.js';

describe('SpawnTriggerManager', () => {
  it('triggers spawn when phase has queue with ready tasks', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: 3 }],
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'implement',
      readyTasks: ['T001', 'T002'],
      activeAgentCount: 0,
    });

    expect(spawns).toHaveLength(2);
    expect(spawns[0].taskId).toBe('T001');
  });

  it('respects parallel limit', () => {
    const manager = new SpawnTriggerManager({
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: 2 }],
      queues: { tasks: { name: 'tasks' } },
    });

    const spawns = manager.checkTriggers({
      currentPhase: 'implement',
      readyTasks: ['T001', 'T002', 'T003'],
      activeAgentCount: 1,
    });

    expect(spawns).toHaveLength(1); // 2 max - 1 active = 1 more
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/workflow/spawn-trigger.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/workflow/spawn-trigger.ts
import type { CompiledPhase, CompiledQueue } from '@hyh/dsl';

interface SpawnTriggerConfig {
  phases: Array<Partial<CompiledPhase>>;
  queues: Record<string, Partial<CompiledQueue>>;
}

interface TriggerContext {
  currentPhase: string;
  readyTasks: string[];
  activeAgentCount: number;
}

export interface SpawnSpec {
  agentType: string;
  taskId: string;
}

export class SpawnTriggerManager {
  private readonly phases: Map<string, Partial<CompiledPhase>>;

  constructor(config: SpawnTriggerConfig) {
    this.phases = new Map();
    for (const phase of config.phases) {
      if (phase.name) {
        this.phases.set(phase.name, phase);
      }
    }
  }

  checkTriggers(context: TriggerContext): SpawnSpec[] {
    const phase = this.phases.get(context.currentPhase);
    if (!phase || !phase.queue || !phase.agent) return [];

    const maxParallel = phase.parallel === true
      ? Infinity
      : (typeof phase.parallel === 'number' ? phase.parallel : 1);

    const availableSlots = Math.max(0, maxParallel - context.activeAgentCount);
    const toSpawn = Math.min(context.readyTasks.length, availableSlots);

    return context.readyTasks.slice(0, toSpawn).map(taskId => ({
      agentType: phase.agent!,
      taskId,
    }));
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/workflow/spawn-trigger.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/workflow/spawn-trigger.ts packages/daemon/src/workflow/spawn-trigger.test.ts
git commit -m "feat(daemon): add SpawnTriggerManager for parallel agent spawning"
```

---

### Task 8: Plan Importer

**Files:**
- Create: `packages/daemon/src/plan/importer.ts`
- Create: `packages/daemon/src/plan/importer.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/plan/importer.test.ts
import { describe, it, expect } from 'vitest';
import { PlanImporter } from './importer.js';

describe('PlanImporter', () => {
  it('parses tasks.md format into task states', () => {
    const markdown = `
# Tasks

## Task 1: Setup
- Files: src/setup.ts
- Dependencies: none

## Task 2: Feature
- Files: src/feature.ts
- Dependencies: Task 1
`;

    const importer = new PlanImporter();
    const tasks = importer.parseMarkdown(markdown);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('task-1');
    expect(tasks[1].dependencies).toContain('task-1');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/plan/importer.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/plan/importer.ts
import type { TaskState } from '../types/state.js';
import { TaskStatus } from '../types/state.js';

interface ParsedTask {
  id: string;
  description: string;
  files: string[];
  dependencies: string[];
}

export class PlanImporter {
  parseMarkdown(content: string): ParsedTask[] {
    const tasks: ParsedTask[] = [];
    const taskRegex = /##\s+Task\s+(\d+):\s+(.+)/g;
    const sections = content.split(/(?=##\s+Task)/);

    for (const section of sections) {
      const match = section.match(/##\s+Task\s+(\d+):\s+(.+)/);
      if (!match) continue;

      const [, num, description] = match;
      const id = `task-${num}`;

      // Parse files
      const filesMatch = section.match(/Files?:\s*(.+)/i);
      const files = filesMatch
        ? filesMatch[1].split(',').map(f => f.trim())
        : [];

      // Parse dependencies
      const depsMatch = section.match(/Dependencies?:\s*(.+)/i);
      let dependencies: string[] = [];
      if (depsMatch && depsMatch[1].toLowerCase() !== 'none') {
        dependencies = depsMatch[1]
          .split(',')
          .map(d => d.trim().toLowerCase().replace(/task\s+/i, 'task-'));
      }

      tasks.push({ id, description: description.trim(), files, dependencies });
    }

    return tasks;
  }

  toTaskStates(parsed: ParsedTask[]): Record<string, TaskState> {
    const states: Record<string, TaskState> = {};
    for (const task of parsed) {
      states[task.id] = {
        id: task.id,
        description: task.description,
        status: TaskStatus.PENDING,
        claimedBy: null,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
        attempts: 0,
        lastError: null,
        dependencies: task.dependencies,
        files: task.files,
        timeoutSeconds: 600,
      };
    }
    return states;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/plan/importer.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/plan/
git commit -m "feat(daemon): add PlanImporter for parsing task markdown"
```

---

### Task 9: CLI Run Command

**Files:**
- Create: `packages/cli/src/commands/run.ts`
- Modify: `packages/cli/src/index.ts:24-25`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/cli/src/commands/run.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('run command', () => {
  it('compiles workflow and starts daemon', async () => {
    // This is an integration test - verify command structure exists
    const { registerRunCommand } = await import('./run.js');
    expect(registerRunCommand).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/cli/src/commands/run.ts
import { Command } from 'commander';
import * as path from 'node:path';
import { compileToDir } from '@hyh/dsl';
import { Daemon } from '@hyh/daemon';

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run a workflow')
    .argument('<workflow>', 'Path to workflow.ts file')
    .option('--no-tui', 'Run without TUI (headless mode)')
    .action(async (workflowPath: string, options: { tui: boolean }) => {
      const absolutePath = path.resolve(workflowPath);
      const projectDir = path.dirname(absolutePath);
      const outputDir = path.join(projectDir, '.hyh');

      console.log(`Compiling ${workflowPath}...`);

      // Dynamic import of the workflow file
      const module = await import(absolutePath);
      const workflow = module.default;

      if (!workflow || typeof workflow !== 'object') {
        console.error('Workflow file must export default workflow');
        process.exit(1);
      }

      // Compile to .hyh/
      await compileToDir(workflow, outputDir);
      console.log(`Compiled to ${outputDir}`);

      // Start daemon
      const daemon = new Daemon({ worktreeRoot: projectDir });
      await daemon.start();
      console.log(`Daemon started on ${daemon.getSocketPath()}`);

      // Keep running until interrupted
      process.on('SIGINT', async () => {
        console.log('\nShutting down...');
        await daemon.stop();
        process.exit(0);
      });

      if (!options.tui) {
        console.log('Running in headless mode. Press Ctrl+C to stop.');
      } else {
        console.log('TUI not yet implemented. Running in headless mode.');
      }
    });
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts
```

Expected: PASS

**Step 5: Register command and commit** (30 sec)

```bash
# Add to packages/cli/src/index.ts:
# import { registerRunCommand } from './commands/run.js';
# registerRunCommand(program);

git add packages/cli/src/commands/run.ts packages/cli/src/commands/run.test.ts packages/cli/src/index.ts
git commit -m "feat(cli): add run command for workflow execution"
```

---

### Task 10: CLI Init Command

**Files:**
- Create: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/cli/src/commands/init.test.ts
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('init command', () => {
  it('creates workflow.ts template', async () => {
    const { createWorkflowTemplate } = await import('./init.js');
    const template = createWorkflowTemplate();

    expect(template).toContain("import { workflow");
    expect(template).toContain("export default workflow");
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/commands/init.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/cli/src/commands/init.ts
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export function createWorkflowTemplate(): string {
  return `import { workflow, agent, queue, inv, correct, human } from '@hyh/dsl';

// Define agents
const orchestrator = agent('orchestrator')
  .model('opus')
  .role('coordinator')
  .tools('Read', 'Grep', 'Bash(hyh:*)');

const worker = agent('worker')
  .model('sonnet')
  .role('implementation')
  .tools('Read', 'Write', 'Edit', 'Bash(npm:*)', 'Bash(git:*)', 'Bash(hyh:*)')
  .invariants(
    inv.tdd({ test: '**/*.test.ts', impl: 'src/**/*.ts' }),
  );

// Define queues
const tasks = queue('tasks')
  .ready(task => task.deps.allComplete)
  .timeout('10m');

// Define workflow
export default workflow('my-feature')
  .resumable()
  .orchestrator(orchestrator)

  .phase('plan')
    .agent(orchestrator)
    .output('plan.md', 'tasks.md')
    .populates(tasks)
    .checkpoint(human.approval())

  .phase('implement')
    .queue(tasks)
    .agent(worker)
    .parallel()

  .build();
`;
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new workflow project')
    .option('-d, --dir <directory>', 'Target directory', '.')
    .action(async (options: { dir: string }) => {
      const targetDir = path.resolve(options.dir);
      const workflowPath = path.join(targetDir, 'workflow.ts');
      const hyhDir = path.join(targetDir, '.hyh');

      // Check if workflow.ts already exists
      try {
        await fs.access(workflowPath);
        console.error('workflow.ts already exists');
        process.exit(1);
      } catch {
        // File doesn't exist, good to proceed
      }

      // Create workflow.ts
      await fs.writeFile(workflowPath, createWorkflowTemplate());
      console.log('Created workflow.ts');

      // Create .hyh directory
      await fs.mkdir(hyhDir, { recursive: true });
      console.log('Created .hyh/');

      console.log('\nNext steps:');
      console.log('  1. Edit workflow.ts to define your workflow');
      console.log('  2. Run: hyh validate workflow.ts');
      console.log('  3. Run: hyh run workflow.ts');
    });
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/commands/init.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/commands/init.test.ts packages/cli/src/index.ts
git commit -m "feat(cli): add init command for project scaffolding"
```

---

## Phase 4: Multi-Agent & Worktrees

### Task 11: Worktree Manager

**Files:**
- Create: `packages/daemon/src/git/worktree.ts`
- Create: `packages/daemon/src/git/worktree.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/git/worktree.test.ts
import { describe, it, expect, vi } from 'vitest';
import { WorktreeManager } from './worktree.js';

describe('WorktreeManager', () => {
  it('generates worktree path for wave', () => {
    const manager = new WorktreeManager('/project');
    const path = manager.getWorktreePath(1);
    expect(path).toBe('/project--wave-1');
  });

  it('calculates wave from task dependencies', () => {
    const manager = new WorktreeManager('/project');
    const wave = manager.calculateWave({
      id: 'task-3',
      dependencies: ['task-1', 'task-2'],
    }, {
      'task-1': { id: 'task-1', dependencies: [] },
      'task-2': { id: 'task-2', dependencies: ['task-1'] },
    });
    expect(wave).toBe(2); // task-2 is wave 1, so task-3 is wave 2
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/git/worktree.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/git/worktree.ts
import { execSync } from 'node:child_process';

interface TaskDep {
  id: string;
  dependencies: string[];
}

export class WorktreeManager {
  private readonly mainRepo: string;

  constructor(mainRepo: string) {
    this.mainRepo = mainRepo;
  }

  getWorktreePath(wave: number): string {
    return `${this.mainRepo}--wave-${wave}`;
  }

  calculateWave(task: TaskDep, allTasks: Record<string, TaskDep>): number {
    if (task.dependencies.length === 0) return 0;

    let maxDepWave = 0;
    for (const depId of task.dependencies) {
      const depTask = allTasks[depId];
      if (depTask) {
        const depWave = this.calculateWave(depTask, allTasks);
        maxDepWave = Math.max(maxDepWave, depWave);
      }
    }
    return maxDepWave + 1;
  }

  async create(branch: string): Promise<string> {
    const worktreePath = `${this.mainRepo}--${branch}`;
    execSync(`git -C ${this.mainRepo} worktree add -b ${branch} ${worktreePath}`, {
      encoding: 'utf-8',
    });
    return worktreePath;
  }

  async remove(worktreePath: string): Promise<void> {
    execSync(`git worktree remove ${worktreePath}`, { encoding: 'utf-8' });
  }

  async list(): Promise<string[]> {
    const output = execSync(`git -C ${this.mainRepo} worktree list --porcelain`, {
      encoding: 'utf-8',
    });
    const paths: string[] = [];
    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        paths.push(line.slice(9));
      }
    }
    return paths;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/git/worktree.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/git/
git commit -m "feat(daemon): add WorktreeManager for wave-based parallelism"
```

---

### Task 12: Gate Executor

**Files:**
- Create: `packages/daemon/src/workflow/gate-executor.ts`
- Create: `packages/daemon/src/workflow/gate-executor.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/daemon/src/workflow/gate-executor.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GateExecutor } from './gate-executor.js';

describe('GateExecutor', () => {
  it('passes gate when all checks succeed', async () => {
    const executor = new GateExecutor();
    const result = await executor.execute({
      name: 'quality',
      checks: [
        { type: 'command', command: 'echo "ok"' },
      ],
    });

    expect(result.passed).toBe(true);
  });

  it('fails gate when check fails', async () => {
    const executor = new GateExecutor();
    const result = await executor.execute({
      name: 'quality',
      checks: [
        { type: 'command', command: 'exit 1' },
      ],
    });

    expect(result.passed).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/workflow/gate-executor.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/daemon/src/workflow/gate-executor.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

interface GateCheck {
  type: 'command' | 'verifier';
  command?: string;
  verifier?: string;
}

interface GateConfig {
  name: string;
  checks: GateCheck[];
}

interface GateResult {
  passed: boolean;
  failedCheck?: GateCheck;
  error?: string;
}

export class GateExecutor {
  async execute(gate: GateConfig, cwd?: string): Promise<GateResult> {
    for (const check of gate.checks) {
      if (check.type === 'command' && check.command) {
        try {
          await execAsync(check.command, { cwd });
        } catch (error) {
          return {
            passed: false,
            failedCheck: check,
            error: (error as Error).message,
          };
        }
      }
      // Verifier type would spawn a verifier agent - not implemented yet
    }
    return { passed: true };
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/workflow/gate-executor.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/workflow/gate-executor.ts packages/daemon/src/workflow/gate-executor.test.ts
git commit -m "feat(daemon): add GateExecutor for quality gates"
```

---

## Phase 5: TUI Package

### Task 13: TUI Package Setup

**Files:**
- Create: `packages/tui/package.json`
- Create: `packages/tui/tsconfig.json`
- Create: `packages/tui/src/index.tsx`

**Step 1: Create package structure** (2-5 min)

```bash
mkdir -p packages/tui/src
```

**Step 2: Write package.json** (2-5 min)

```json
{
  "name": "@hyh/tui",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "cctop": "./dist/bin/cctop.js"
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@hyh/daemon": "workspace:*",
    "ink": "^5.0.0",
    "react": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0"
  }
}
```

**Step 3: Write tsconfig.json** (2-5 min)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  },
  "include": ["src/**/*"]
}
```

**Step 4: Write initial index.tsx** (2-5 min)

```typescript
// packages/tui/src/index.tsx
import React from 'react';
import { render, Box, Text } from 'ink';

interface AppProps {
  socketPath: string;
}

export function App({ socketPath }: AppProps) {
  return (
    <Box flexDirection="column">
      <Text bold>hyh - Hold Your Horses</Text>
      <Text dimColor>Connecting to {socketPath}...</Text>
    </Box>
  );
}

export function startTUI(socketPath: string): void {
  render(<App socketPath={socketPath} />);
}
```

**Step 5: Install deps and commit** (30 sec)

```bash
pnpm install
git add packages/tui/
git commit -m "feat(tui): initialize @hyh/tui package with Ink"
```

---

### Task 14: TUI IPC Client Hook

**Files:**
- Create: `packages/tui/src/hooks/useDaemon.ts`
- Create: `packages/tui/src/hooks/useDaemon.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/tui/src/hooks/useDaemon.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useDaemon hook', () => {
  it('exports useDaemon function', async () => {
    const { useDaemon } = await import('./useDaemon.js');
    expect(useDaemon).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/tui/src/hooks/useDaemon.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/tui/src/hooks/useDaemon.ts
import { useState, useEffect, useCallback } from 'react';
import { IPCClient } from '@hyh/daemon';
import type { WorkflowState } from '@hyh/daemon';

interface DaemonConnection {
  connected: boolean;
  state: WorkflowState | null;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useDaemon(socketPath: string): DaemonConnection {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<WorkflowState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [client] = useState(() => new IPCClient(socketPath));

  const refresh = useCallback(async () => {
    try {
      const response = await client.request({ command: 'get_state' });
      if (response.status === 'ok' && response.data) {
        setState((response.data as { state: WorkflowState }).state);
      }
    } catch (err) {
      setError(err as Error);
    }
  }, [client]);

  useEffect(() => {
    async function connect() {
      try {
        await client.connect();
        setConnected(true);
        await refresh();
      } catch (err) {
        setError(err as Error);
      }
    }

    connect();

    return () => {
      client.disconnect();
    };
  }, [client, refresh]);

  return { connected, state, error, refresh };
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/tui/src/hooks/useDaemon.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/tui/src/hooks/
git commit -m "feat(tui): add useDaemon hook for IPC connection"
```

---

### Task 15: Overview Tab Component

**Files:**
- Create: `packages/tui/src/tabs/Overview.tsx`
- Create: `packages/tui/src/components/ProgressBar.tsx`

**Step 1: Write ProgressBar component** (2-5 min)

```typescript
// packages/tui/src/components/ProgressBar.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface ProgressBarProps {
  value: number;
  total: number;
  width?: number;
}

export function ProgressBar({ value, total, width = 40 }: ProgressBarProps) {
  const percentage = total > 0 ? value / total : 0;
  const filled = Math.round(percentage * width);
  const empty = width - filled;

  return (
    <Box>
      <Text>[</Text>
      <Text color="green">{'█'.repeat(filled)}</Text>
      <Text dimColor>{'░'.repeat(empty)}</Text>
      <Text>]</Text>
      <Text> {value}/{total} ({Math.round(percentage * 100)}%)</Text>
    </Box>
  );
}
```

**Step 2: Write Overview tab** (2-5 min)

```typescript
// packages/tui/src/tabs/Overview.tsx
import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar } from '../components/ProgressBar.js';
import type { WorkflowState } from '@hyh/daemon';

interface OverviewProps {
  state: WorkflowState | null;
}

export function Overview({ state }: OverviewProps) {
  if (!state) {
    return <Text dimColor>No workflow state</Text>;
  }

  const tasks = Object.values(state.tasks);
  const completed = tasks.filter(t => t.status === 'completed').length;
  const running = tasks.filter(t => t.status === 'running').length;
  const pending = tasks.filter(t => t.status === 'pending').length;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>PHASE: {state.currentPhase}</Text>
      <Box marginY={1}>
        <ProgressBar value={completed} total={tasks.length} />
      </Box>
      <Box flexDirection="column">
        <Text>Completed: <Text color="green">{completed}</Text></Text>
        <Text>Running: <Text color="yellow">{running}</Text></Text>
        <Text>Pending: <Text dimColor>{pending}</Text></Text>
      </Box>
    </Box>
  );
}
```

**Step 3: Commit** (30 sec)

```bash
git add packages/tui/src/tabs/ packages/tui/src/components/
git commit -m "feat(tui): add Overview tab with progress bar"
```

---

### Task 16: Tab Navigation

**Files:**
- Modify: `packages/tui/src/index.tsx`
- Create: `packages/tui/src/tabs/Agents.tsx`
- Create: `packages/tui/src/tabs/Tasks.tsx`

**Step 1: Write Agents tab** (2-5 min)

```typescript
// packages/tui/src/tabs/Agents.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { WorkflowState } from '@hyh/daemon';

interface AgentsProps {
  state: WorkflowState | null;
}

export function Agents({ state }: AgentsProps) {
  if (!state) {
    return <Text dimColor>No agents</Text>;
  }

  const agents = Object.values(state.agents);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>AGENTS ({agents.length})</Text>
      {agents.map(agent => (
        <Box key={agent.id} marginTop={1}>
          <Text>
            {agent.status === 'active' ? '●' : '○'} {agent.id}
            <Text dimColor> ({agent.type})</Text>
            {agent.currentTask && <Text color="yellow"> → {agent.currentTask}</Text>}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

**Step 2: Write Tasks tab** (2-5 min)

```typescript
// packages/tui/src/tabs/Tasks.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { WorkflowState } from '@hyh/daemon';

interface TasksProps {
  state: WorkflowState | null;
}

const STATUS_ICONS: Record<string, string> = {
  completed: '✓',
  running: '●',
  pending: '○',
  failed: '✗',
};

export function Tasks({ state }: TasksProps) {
  if (!state) {
    return <Text dimColor>No tasks</Text>;
  }

  const tasks = Object.values(state.tasks);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>TASKS ({tasks.length})</Text>
      {tasks.map(task => (
        <Box key={task.id} marginTop={1}>
          <Text>
            {STATUS_ICONS[task.status] || '?'} {task.id}
            <Text dimColor> - {task.description.slice(0, 40)}</Text>
            {task.claimedBy && <Text color="yellow"> [{task.claimedBy}]</Text>}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

**Step 3: Update main App with tabs** (2-5 min)

```typescript
// packages/tui/src/index.tsx
import React, { useState } from 'react';
import { render, Box, Text, useInput } from 'ink';
import { useDaemon } from './hooks/useDaemon.js';
import { Overview } from './tabs/Overview.js';
import { Agents } from './tabs/Agents.js';
import { Tasks } from './tabs/Tasks.js';

const TABS = ['Overview', 'Agents', 'Tasks', 'Logs', 'Trajectory'];

interface AppProps {
  socketPath: string;
}

export function App({ socketPath }: AppProps) {
  const [activeTab, setActiveTab] = useState(0);
  const { connected, state, error } = useDaemon(socketPath);

  useInput((input, key) => {
    if (input >= '1' && input <= '5') {
      setActiveTab(parseInt(input) - 1);
    }
    if (input === 'q') {
      process.exit(0);
    }
  });

  if (error) {
    return <Text color="red">Error: {error.message}</Text>;
  }

  if (!connected) {
    return <Text dimColor>Connecting to {socketPath}...</Text>;
  }

  const TabComponent = [Overview, Agents, Tasks, Overview, Overview][activeTab];

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1}>
        <Text bold>hyh</Text>
        <Text dimColor> - {state?.workflowName || 'Unknown'}</Text>
        <Box marginLeft={2}>
          {TABS.map((tab, i) => (
            <Text key={tab}>
              <Text color={i === activeTab ? 'cyan' : undefined}>
                [{i + 1}] {tab}
              </Text>
              <Text>  </Text>
            </Text>
          ))}
        </Box>
      </Box>
      <TabComponent state={state} />
      <Box marginTop={1}>
        <Text dimColor>[q] quit  [1-5] switch tabs</Text>
      </Box>
    </Box>
  );
}

export function startTUI(socketPath: string): void {
  render(<App socketPath={socketPath} />);
}
```

**Step 4: Commit** (30 sec)

```bash
git add packages/tui/src/
git commit -m "feat(tui): add tab navigation with Overview, Agents, Tasks tabs"
```

---

## Phase 6: Polish

### Task 17: CLI Heartbeat Command

**Files:**
- Create: `packages/cli/src/commands/heartbeat.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/cli/src/commands/heartbeat.test.ts
import { describe, it, expect } from 'vitest';

describe('heartbeat command', () => {
  it('exports registerHeartbeatCommand', async () => {
    const { registerHeartbeatCommand } = await import('./heartbeat.js');
    expect(registerHeartbeatCommand).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/commands/heartbeat.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/cli/src/commands/heartbeat.ts
import { Command } from 'commander';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath } from '../utils/socket.js';
import { getWorkerId } from '../utils/worker-id.js';

export function registerHeartbeatCommand(program: Command): void {
  program
    .command('heartbeat')
    .description('Send heartbeat to daemon')
    .action(async () => {
      const socketPath = await findSocketPath();
      if (!socketPath) {
        console.error('No active workflow');
        process.exit(1);
      }

      const workerId = await getWorkerId();
      const client = new IPCClient(socketPath);

      try {
        await client.connect();
        const response = await client.request({
          command: 'heartbeat',
          workerId,
        });

        if (response.status === 'ok') {
          console.log('Heartbeat sent');
        } else {
          console.error('Heartbeat failed:', response.message);
          process.exit(1);
        }
      } finally {
        await client.disconnect();
      }
    });
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/commands/heartbeat.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/commands/heartbeat.ts packages/cli/src/commands/heartbeat.test.ts
git commit -m "feat(cli): add heartbeat command"
```

---

### Task 18: Daemon Heartbeat Handler

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts:175-190`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to packages/daemon/src/core/daemon.test.ts
it('handles heartbeat request', async () => {
  const daemon = new Daemon({ worktreeRoot: '/tmp/test' });
  // Test heartbeat handler exists
});
```

**Step 2: Add heartbeat handler to daemon** (2-5 min)

```typescript
// Add to packages/daemon/src/core/daemon.ts registerHandlers():

// Heartbeat
this.ipcServer.registerHandler('heartbeat', async (request: unknown) => {
  const req = request as { workerId: string };

  // Record heartbeat in trajectory
  await this.trajectory.log({
    type: 'heartbeat',
    timestamp: Date.now(),
    agentId: req.workerId,
  });

  return { ok: true, timestamp: Date.now() };
});
```

**Step 3: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): add heartbeat IPC handler"
```

---

### Task 19: CLI Validate Command

**Files:**
- Create: `packages/cli/src/commands/validate.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/cli/src/commands/validate.test.ts
import { describe, it, expect } from 'vitest';

describe('validate command', () => {
  it('exports registerValidateCommand', async () => {
    const { registerValidateCommand } = await import('./validate.js');
    expect(registerValidateCommand).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/commands/validate.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (2-5 min)

```typescript
// packages/cli/src/commands/validate.ts
import { Command } from 'commander';
import * as path from 'node:path';
import { compile } from '@hyh/dsl';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate a workflow file')
    .argument('<workflow>', 'Path to workflow.ts file')
    .action(async (workflowPath: string) => {
      const absolutePath = path.resolve(workflowPath);

      try {
        console.log(`Validating ${workflowPath}...`);

        // Dynamic import
        const module = await import(absolutePath);
        const workflow = module.default;

        if (!workflow || typeof workflow !== 'object') {
          console.error('Error: Workflow file must export default workflow');
          process.exit(1);
        }

        // Validate using compile
        compile(workflow, { validate: true });

        console.log('✓ Workflow is valid');
        console.log(`  Name: ${workflow.name}`);
        console.log(`  Phases: ${workflow.phases?.length || 0}`);
        console.log(`  Agents: ${Object.keys(workflow.agents || {}).length}`);
      } catch (error) {
        console.error('✗ Validation failed:');
        console.error(`  ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/commands/validate.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/commands/validate.ts packages/cli/src/commands/validate.test.ts
git commit -m "feat(cli): add validate command for workflow validation"
```

---

### Task 20: Integration Test & Export Updates

**Files:**
- Modify: `packages/daemon/src/index.ts` (export all modules)
- Create: `packages/daemon/src/index.test.ts`

**Step 1: Update daemon exports** (2-5 min)

```typescript
// packages/daemon/src/index.ts
// Core
export { Daemon } from './core/daemon.js';
export { EventLoop } from './core/event-loop.js';

// State
export { StateManager } from './state/manager.js';
export type { WorkflowState, TaskState, AgentState } from './types/state.js';
export { TaskStatus } from './types/state.js';

// Trajectory
export { TrajectoryLogger } from './trajectory/logger.js';
export type { TrajectoryEvent } from './types/trajectory.js';

// IPC
export { IPCServer } from './ipc/server.js';
export type { IPCRequest, IPCResponse } from './types/ipc.js';

// Agents
export { AgentProcess } from './agents/process.js';
export { AgentManager } from './agents/manager.js';
export { HeartbeatMonitor } from './agents/heartbeat.js';

// Checkers
export { CheckerChain } from './checkers/chain.js';
export { TddChecker } from './checkers/tdd.js';
export { FileScopeChecker } from './checkers/file-scope.js';
export { NoCodeChecker } from './checkers/no-code.js';
export { MustProgressChecker } from './checkers/must-progress.js';

// Workflow
export { WorkflowLoader } from './workflow/loader.js';
export { PhaseManager } from './workflow/phase-manager.js';
export { SpawnTriggerManager } from './workflow/spawn-trigger.js';
export { GateExecutor } from './workflow/gate-executor.js';

// Plan
export { PlanImporter } from './plan/importer.js';

// Corrections
export { CorrectionApplicator } from './corrections/applicator.js';

// Git
export { WorktreeManager } from './git/worktree.js';
```

**Step 2: Write integration test** (2-5 min)

```typescript
// packages/daemon/src/index.test.ts
import { describe, it, expect } from 'vitest';
import * as daemon from './index.js';

describe('@hyh/daemon exports', () => {
  it('exports Daemon class', () => {
    expect(daemon.Daemon).toBeDefined();
  });

  it('exports StateManager', () => {
    expect(daemon.StateManager).toBeDefined();
  });

  it('exports all checkers', () => {
    expect(daemon.CheckerChain).toBeDefined();
    expect(daemon.TddChecker).toBeDefined();
    expect(daemon.FileScopeChecker).toBeDefined();
  });
});
```

**Step 3: Run all tests** (30 sec)

```bash
pnpm test
```

Expected: All tests pass

**Step 4: Commit** (30 sec)

```bash
git add packages/daemon/src/index.ts packages/daemon/src/index.test.ts
git commit -m "feat(daemon): export all modules from package index"
```

---

### Task 21: Code Review

**Files:** All changed files

**Step 1: Run full test suite** (2-5 min)

```bash
pnpm test
```

**Step 2: Run type check** (30 sec)

```bash
pnpm typecheck
```

**Step 3: Run linter** (30 sec)

```bash
pnpm lint
```

**Step 4: Build all packages** (30 sec)

```bash
pnpm build
```

**Step 5: Review and commit any fixes** (2-5 min)

```bash
git add -A
git commit -m "chore: fix any lint/type issues from implementation"
```

---

## Parallel Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3 | Daemon core: loader, event loop, phase manager - no overlap |
| Group 2 | 4, 5, 6 | Checkers and corrections - independent modules |
| Group 3 | 7, 8, 9, 10 | Agent management: spawn triggers, plan import, CLI commands |
| Group 4 | 11, 12 | Multi-agent: worktrees, gates |
| Group 5 | 13, 14, 15, 16 | TUI package - all new files |
| Group 6 | 17, 18, 19, 20 | CLI polish and exports |
| Group 7 | 21 | Code review - depends on all above |

---

## Summary

This plan covers the remaining implementation from Phase 2 through Phase 6:

- **Phase 2 (Tasks 1-6):** Complete daemon core with event loop, workflow loading, phase transitions, additional checkers, and correction application.
- **Phase 3 (Tasks 7-10):** Agent management with spawn triggers, plan importing, and CLI run/init commands.
- **Phase 4 (Tasks 11-12):** Multi-agent support with worktree management and gate execution.
- **Phase 5 (Tasks 13-16):** Full TUI package with Ink components and tab navigation.
- **Phase 6 (Tasks 17-21):** Polish with remaining CLI commands, exports, and code review.

Total: 21 tasks, ~7 parallel groups, estimated implementation time with TDD: 2-3 days focused work.
