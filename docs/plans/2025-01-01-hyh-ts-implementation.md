# hyh-ts Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-hyh-ts-implementation.md` to implement task-by-task.

**Goal:** Implement a TypeScript workflow orchestration system that defines multi-agent workflows for Claude Code, compiles to runtime checkers and agent prompts, and executes workflows with invariant enforcement.

**Architecture:** Monorepo with pnpm workspaces containing `@hyh/dsl` (fluent DSL for workflow definition) and `@hyh/daemon` (runtime engine with Unix socket IPC). Uses Zod for runtime validation, Vitest for testing, and ports patterns from Python reference (msgspec structs → Zod schemas, thread locks → async-mutex).

**Tech Stack:** TypeScript 5.x, Node.js 20+, pnpm workspaces, Vitest, Zod, proper-lockfile, async-mutex, fast-xml-parser

---

## Phase 1: Monorepo Foundation

### Task 1: Initialize Monorepo Structure

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Create root package.json** (2-5 min)

```json
{
  "name": "hyh",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "lint": "eslint packages/*/src --ext .ts",
    "clean": "pnpm -r clean && rm -rf node_modules"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0",
    "eslint": "^9.17.0",
    "@typescript-eslint/parser": "^8.18.0",
    "@typescript-eslint/eslint-plugin": "^8.18.0"
  }
}
```

**Step 2: Create pnpm-workspace.yaml** (30 sec)

```yaml
packages:
  - 'packages/*'
```

**Step 3: Create tsconfig.base.json** (2 min)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Step 4: Create root tsconfig.json** (30 sec)

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "references": [
    { "path": "packages/dsl" },
    { "path": "packages/daemon" }
  ]
}
```

**Step 5: Create vitest.config.ts** (2 min)

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
    },
  },
});
```

**Step 6: Create .gitignore** (30 sec)

```
node_modules/
dist/
.hyh/
*.log
.DS_Store
coverage/
.turbo/
```

**Step 7: Create .nvmrc** (30 sec)

```
20
```

**Step 8: Initialize and verify** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm install
```

Expected: pnpm installs dependencies successfully

**Step 9: Commit** (30 sec)

```bash
git add -A && git commit -m "chore: initialize monorepo with pnpm workspaces"
```

---

### Task 2: Create @hyh/dsl Package Scaffold

**Files:**
- Create: `packages/dsl/package.json`
- Create: `packages/dsl/tsconfig.json`
- Create: `packages/dsl/src/index.ts`

**Step 1: Create packages/dsl directory** (30 sec)

```bash
mkdir -p /Users/pedroproenca/Documents/Projects/hyh-ts/packages/dsl/src
```

**Step 2: Create packages/dsl/package.json** (2 min)

```json
{
  "name": "@hyh/dsl",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "zod": "^3.24.0",
    "picomatch": "^4.0.0",
    "fast-xml-parser": "^4.5.0"
  },
  "devDependencies": {
    "@types/picomatch": "^3.0.0"
  },
  "peerDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**Step 3: Create packages/dsl/tsconfig.json** (1 min)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"]
}
```

**Step 4: Create packages/dsl/src/index.ts** (1 min)

```typescript
// @hyh/dsl - TypeScript Workflow DSL
// Fluent API for defining multi-agent workflows

export { workflow } from './builders/workflow.js';
export { agent } from './builders/agent.js';
export { queue } from './builders/queue.js';
export { gate } from './builders/gate.js';
export { task } from './builders/task.js';
export { inv } from './invariants/index.js';
export { correct } from './corrections/index.js';
export { human } from './checkpoints/human.js';

// Types
export type {
  CompiledWorkflow,
  CompiledAgent,
  CompiledPhase,
  CompiledQueue,
  CompiledGate,
  CompiledInvariant,
  Correction,
  Checkpoint,
} from './types/compiled.js';

export type {
  Duration,
  ToolSpec,
  GlobPattern,
  Model,
  TaskStatus,
} from './types/primitives.js';
```

**Step 5: Install dependencies** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm install
```

**Step 6: Commit** (30 sec)

```bash
git add -A && git commit -m "chore(dsl): scaffold @hyh/dsl package"
```

---

### Task 3: Create @hyh/daemon Package Scaffold

**Files:**
- Create: `packages/daemon/package.json`
- Create: `packages/daemon/tsconfig.json`
- Create: `packages/daemon/src/index.ts`

**Step 1: Create packages/daemon directory** (30 sec)

```bash
mkdir -p /Users/pedroproenca/Documents/Projects/hyh-ts/packages/daemon/src
```

**Step 2: Create packages/daemon/package.json** (2 min)

```json
{
  "name": "@hyh/daemon",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "hyh-daemon": "./dist/bin/daemon.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@hyh/dsl": "workspace:*",
    "zod": "^3.24.0",
    "async-mutex": "^0.5.0",
    "proper-lockfile": "^4.1.0",
    "pino": "^9.6.0"
  },
  "devDependencies": {
    "@types/proper-lockfile": "^4.1.0"
  }
}
```

**Step 3: Create packages/daemon/tsconfig.json** (1 min)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "composite": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/**/*.test.ts"],
  "references": [
    { "path": "../dsl" }
  ]
}
```

**Step 4: Create packages/daemon/src/index.ts** (1 min)

```typescript
// @hyh/daemon - Workflow Runtime Engine
// Manages agent processes, enforces invariants, persists state

export { Daemon } from './core/daemon.js';
export { StateManager } from './state/manager.js';
export { TrajectoryLogger } from './trajectory/logger.js';
export { AgentManager } from './agents/manager.js';
export { IPCServer } from './ipc/server.js';
export { CheckerChain } from './checkers/chain.js';

// Types
export type {
  WorkflowState,
  TaskState,
  AgentState,
  QueueState,
} from './types/state.js';

export type {
  TrajectoryEvent,
  ToolUseEvent,
  CorrectionEvent,
  SpawnEvent,
} from './types/trajectory.js';

export type {
  IPCRequest,
  IPCResponse,
  IPCEvent,
} from './types/ipc.js';
```

**Step 5: Install dependencies** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm install
```

**Step 6: Commit** (30 sec)

```bash
git add -A && git commit -m "chore(daemon): scaffold @hyh/daemon package"
```

---

## Phase 2: DSL Core Types

### Task 4: Implement Primitive Types

**Files:**
- Create: `packages/dsl/src/types/primitives.ts`
- Create: `packages/dsl/src/types/primitives.test.ts`

**Step 1: Write failing test for Duration type** (2-5 min)

```typescript
// packages/dsl/src/types/primitives.test.ts
import { describe, it, expect } from 'vitest';
import { parseDuration, Duration } from './primitives.js';

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30000);
  });

  it('parses minutes', () => {
    expect(parseDuration('10m')).toBe(600000);
  });

  it('parses hours', () => {
    expect(parseDuration('2h')).toBe(7200000);
  });

  it('passes through milliseconds as number', () => {
    expect(parseDuration(5000)).toBe(5000);
  });

  it('throws on invalid format', () => {
    expect(() => parseDuration('10x' as Duration)).toThrow('Invalid duration');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/types/primitives.test.ts
```

Expected: FAIL (module not found)

**Step 3: Implement primitives.ts** (5 min)

```typescript
// packages/dsl/src/types/primitives.ts
import { z } from 'zod';

// Duration: string like '10m', '30s', '2h' or milliseconds as number
type DurationUnit = 's' | 'm' | 'h' | 'd';
export type Duration = `${number}${DurationUnit}` | number;

const UNIT_MS: Record<DurationUnit, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDuration(duration: Duration): number {
  if (typeof duration === 'number') {
    return duration;
  }

  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  const [, value, unit] = match;
  return parseInt(value!, 10) * UNIT_MS[unit as DurationUnit];
}

// Glob pattern for file matching
export type GlobPattern = string;

// Claude model types
export const ModelSchema = z.enum(['haiku', 'sonnet', 'opus']);
export type Model = z.infer<typeof ModelSchema>;

// Task status
export const TaskStatusSchema = z.enum([
  'pending',
  'claimed',
  'running',
  'verifying',
  'complete',
  'failed',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Tool specification with optional constraints
export type ToolSpec = string | { tool: string; pattern?: string };

export interface ParsedToolSpec {
  tool: string;
  pattern?: string;
}

export function parseToolSpec(spec: ToolSpec): ParsedToolSpec {
  if (typeof spec === 'string') {
    const match = spec.match(/^(\w+)(?:\(([^)]+)\))?$/);
    if (!match) {
      throw new Error(`Invalid tool spec: ${spec}`);
    }
    const [, tool, pattern] = match;
    return { tool: tool!, pattern: pattern || undefined };
  }
  return spec;
}

// Duration schema for Zod validation
export const DurationSchema = z.union([
  z.number().positive(),
  z.string().regex(/^\d+(s|m|h|d)$/),
]);
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/types/primitives.test.ts
```

Expected: PASS (5 passed)

**Step 5: Add ToolSpec tests** (2 min)

```typescript
// Add to primitives.test.ts
describe('parseToolSpec', () => {
  it('parses simple tool name', () => {
    expect(parseToolSpec('Read')).toEqual({ tool: 'Read', pattern: undefined });
  });

  it('parses tool with pattern', () => {
    expect(parseToolSpec('Bash(npm:*)')).toEqual({ tool: 'Bash', pattern: 'npm:*' });
  });

  it('parses object spec', () => {
    expect(parseToolSpec({ tool: 'Write', pattern: 'src/**' })).toEqual({
      tool: 'Write',
      pattern: 'src/**',
    });
  });
});
```

**Step 6: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/types/primitives.test.ts
```

Expected: PASS (8 passed)

**Step 7: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): add primitive types with Duration and ToolSpec parsing"
```

---

### Task 5: Implement Compiled Types

**Files:**
- Create: `packages/dsl/src/types/compiled.ts`
- Create: `packages/dsl/src/types/context.ts`

**Step 1: Create compiled.ts** (5 min)

```typescript
// packages/dsl/src/types/compiled.ts
import { z } from 'zod';
import { Model, TaskStatus, GlobPattern, ToolSpec } from './primitives.js';

// Correction types
export const CorrectionTypeSchema = z.enum([
  'prompt',
  'warn',
  'block',
  'restart',
  'reassign',
  'retry',
  'escalate',
  'compact',
]);
export type CorrectionType = z.infer<typeof CorrectionTypeSchema>;

export interface Correction {
  type: CorrectionType;
  message?: string;
  to?: 'orchestrator' | 'human';
  max?: number;
  backoff?: number;
  preserveTypes?: string[];
  then?: Correction;
}

// Checkpoint types
export interface Checkpoint {
  id: string;
  type: 'approval';
  question?: string;
  timeout?: number;
  onTimeout?: 'abort' | 'continue' | 'escalate';
}

// Compiled invariant
export interface CompiledInvariant {
  type: string;
  agentName?: string;
  options?: Record<string, unknown>;
}

// Compiled agent
export interface CompiledAgent {
  name: string;
  model: Model;
  role: string;
  tools: ToolSpec[];
  spawns: string[];
  invariants: CompiledInvariant[];
  violations: Record<string, Correction[]>;
  heartbeat?: {
    interval: number;
    corrections: Array<{ count: number; correction: Correction }>;
  };
  systemPrompt?: string;
}

// Compiled phase
export interface CompiledPhase {
  name: string;
  agent: string;
  queue?: string;
  expects: string[];
  forbids: string[];
  requires: string[];
  outputs: string[];
  populates?: string;
  parallel: boolean | number;
  gate?: string;
  then?: string;
  checkpoint?: Checkpoint;
}

// Compiled queue
export interface CompiledQueue {
  name: string;
  readyPredicate: string;
  timeout: number;
}

// Compiled gate
export interface CompiledGate {
  name: string;
  requires: string[];
  onFail?: Correction;
  onFailFinal?: Correction;
}

// Compiled workflow (full structure)
export interface CompiledWorkflow {
  name: string;
  resumable: boolean;
  orchestrator: string;
  agents: Record<string, CompiledAgent>;
  phases: CompiledPhase[];
  queues: Record<string, CompiledQueue>;
  gates: Record<string, CompiledGate>;
}
```

**Step 2: Create context.ts** (3 min)

```typescript
// packages/dsl/src/types/context.ts
import { TaskStatus } from './primitives.js';

// Task type for runtime context
export interface Task {
  id: string;
  description: string;
  instructions: string;
  success: string;
  status: TaskStatus;
  claimedBy: string | null;
  startedAt: number | null;
  completedAt: number | null;
  deps: {
    ids: string[];
    allComplete: boolean;
  };
  files: string[];
  role?: string;
  model?: string;
  priority?: number;
}

// Execution result from running commands
export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  passed: boolean;
}

// Git operations interface
export interface GitOps {
  merge(): Promise<void>;
  commit(message: string): Promise<void>;
  push(): Promise<void>;
}

// Context object available in predicates and callbacks
export interface Context {
  task: Task | null;
  agent: { name: string; type: string };
  phase: string;
  workflow: { name: string };
  trajectory: unknown[];
  exec(cmd: string): Promise<ExecResult>;
  verifiedBy(agentName: string): Promise<boolean>;
  git: GitOps;
  uniqueId(): string;
  lastCheckpoint: unknown;
}
```

**Step 3: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): add compiled workflow and context types"
```

---

## Phase 3: DSL Builders

### Task 6: Implement AgentBuilder

**Files:**
- Create: `packages/dsl/src/builders/agent.ts`
- Create: `packages/dsl/src/builders/agent.test.ts`

**Step 1: Write failing test** (3 min)

```typescript
// packages/dsl/src/builders/agent.test.ts
import { describe, it, expect } from 'vitest';
import { agent } from './agent.js';

describe('AgentBuilder', () => {
  it('creates agent with name', () => {
    const a = agent('worker');
    expect(a.build().name).toBe('worker');
  });

  it('chains model and role', () => {
    const a = agent('worker').model('sonnet').role('implementation');
    const compiled = a.build();
    expect(compiled.model).toBe('sonnet');
    expect(compiled.role).toBe('implementation');
  });

  it('chains tools', () => {
    const a = agent('worker').tools('Read', 'Write', 'Bash(npm:*)');
    expect(a.build().tools).toEqual(['Read', 'Write', 'Bash(npm:*)']);
  });

  it('sets readOnly shorthand', () => {
    const a = agent('verifier').readOnly();
    const compiled = a.build();
    // readOnly should not include Write or Edit in tools
    expect(compiled.tools).not.toContain('Write');
    expect(compiled.tools).not.toContain('Edit');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/agent.test.ts
```

Expected: FAIL (module not found)

**Step 3: Implement agent.ts** (5 min)

```typescript
// packages/dsl/src/builders/agent.ts
import { Model, ToolSpec, parseDuration, Duration } from '../types/primitives.js';
import { CompiledAgent, CompiledInvariant, Correction } from '../types/compiled.js';

interface HeartbeatConfig {
  interval: number;
  corrections: Array<{ count: number; correction: Correction }>;
}

export class AgentBuilder {
  private _name: string;
  private _model: Model = 'sonnet';
  private _role: string = 'worker';
  private _tools: ToolSpec[] = [];
  private _spawns: string[] = [];
  private _invariants: CompiledInvariant[] = [];
  private _violations: Record<string, Correction[]> = {};
  private _heartbeat?: HeartbeatConfig;
  private _isReadOnly: boolean = false;

  constructor(name: string) {
    this._name = name;
  }

  model(model: Model): this {
    this._model = model;
    return this;
  }

  role(role: string): this {
    this._role = role;
    return this;
  }

  tools(...tools: ToolSpec[]): this {
    this._tools.push(...tools);
    return this;
  }

  readOnly(): this {
    this._isReadOnly = true;
    // Filter out Write and Edit if they were added
    this._tools = this._tools.filter(
      (t) => typeof t !== 'string' || !['Write', 'Edit'].includes(t)
    );
    return this;
  }

  spawns(otherAgent: AgentBuilder): this {
    this._spawns.push(otherAgent._name);
    return this;
  }

  heartbeat(interval: Duration): HeartbeatBuilder {
    this._heartbeat = {
      interval: parseDuration(interval),
      corrections: [],
    };
    return new HeartbeatBuilder(this, this._heartbeat);
  }

  invariants(...invariants: CompiledInvariant[]): this {
    this._invariants.push(...invariants);
    return this;
  }

  onViolation(type: string, correction: Correction): this;
  onViolation(type: string, options: { after: number }, correction: Correction): this;
  onViolation(
    type: string,
    correctionOrOptions: Correction | { after: number },
    maybeCorrection?: Correction
  ): this {
    if (!this._violations[type]) {
      this._violations[type] = [];
    }
    if ('after' in correctionOrOptions && maybeCorrection) {
      // Count-based override - store with after count for later sorting
      this._violations[type]!.push({ ...maybeCorrection, _after: correctionOrOptions.after } as Correction);
    } else {
      this._violations[type]!.push(correctionOrOptions as Correction);
    }
    return this;
  }

  build(): CompiledAgent {
    return {
      name: this._name,
      model: this._model,
      role: this._role,
      tools: this._tools,
      spawns: this._spawns,
      invariants: this._invariants,
      violations: this._violations,
      heartbeat: this._heartbeat,
    };
  }
}

class HeartbeatBuilder {
  constructor(
    private _parent: AgentBuilder,
    private _config: HeartbeatConfig
  ) {}

  onMiss(correction: Correction): this;
  onMiss(count: number, correction: Correction): this;
  onMiss(countOrCorrection: number | Correction, maybeCorrection?: Correction): this {
    if (typeof countOrCorrection === 'number' && maybeCorrection) {
      this._config.corrections.push({
        count: countOrCorrection,
        correction: maybeCorrection,
      });
    } else {
      this._config.corrections.push({
        count: 1,
        correction: countOrCorrection as Correction,
      });
    }
    return this;
  }

  // Allow chaining back to agent methods
  invariants(...invariants: CompiledInvariant[]): AgentBuilder {
    return this._parent.invariants(...invariants);
  }

  onViolation(type: string, correction: Correction): AgentBuilder {
    return this._parent.onViolation(type, correction);
  }

  build(): CompiledAgent {
    return this._parent.build();
  }
}

export function agent(name: string): AgentBuilder {
  return new AgentBuilder(name);
}
```

**Step 4: Run test to verify pass** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/agent.test.ts
```

Expected: PASS (4 passed)

**Step 5: Add heartbeat and invariant tests** (2 min)

```typescript
// Add to agent.test.ts
import { inv } from '../invariants/index.js';
import { correct } from '../corrections/index.js';

describe('AgentBuilder heartbeat', () => {
  it('configures heartbeat with corrections', () => {
    const a = agent('worker')
      .heartbeat('30s')
      .onMiss(correct.warn('Still working?'))
      .onMiss(3, correct.reassign());

    const compiled = a.build();
    expect(compiled.heartbeat?.interval).toBe(30000);
    expect(compiled.heartbeat?.corrections).toHaveLength(2);
  });
});
```

**Step 6: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): implement AgentBuilder with fluent API"
```

---

### Task 7: Implement QueueBuilder and GateBuilder

**Files:**
- Create: `packages/dsl/src/builders/queue.ts`
- Create: `packages/dsl/src/builders/gate.ts`
- Create: `packages/dsl/src/builders/queue.test.ts`

**Step 1: Write failing test for queue** (2 min)

```typescript
// packages/dsl/src/builders/queue.test.ts
import { describe, it, expect } from 'vitest';
import { queue } from './queue.js';
import { task } from './task.js';

describe('QueueBuilder', () => {
  it('creates queue with name', () => {
    const q = queue('tasks');
    expect(q.build().name).toBe('tasks');
  });

  it('sets ready predicate', () => {
    const q = queue('tasks').ready((task) => task.deps.allComplete);
    expect(q.build().readyPredicate).toBe('task.deps.allComplete');
  });

  it('sets timeout', () => {
    const q = queue('tasks').timeout('10m');
    expect(q.build().timeout).toBe(600000);
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/queue.test.ts
```

Expected: FAIL

**Step 3: Implement queue.ts** (3 min)

```typescript
// packages/dsl/src/builders/queue.ts
import { Duration, parseDuration } from '../types/primitives.js';
import { CompiledQueue } from '../types/compiled.js';
import { Task } from '../types/context.js';
import { TaskBuilder } from './task.js';

export class QueueBuilder {
  private _name: string;
  private _readyPredicate: string = 'true';
  private _timeout: number = 600000; // 10 minutes default
  private _examples: TaskBuilder[] = [];

  constructor(name: string) {
    this._name = name;
  }

  ready(predicate: (task: Task) => boolean): this {
    // Convert function to string representation for serialization
    const fnStr = predicate.toString();
    // Extract the expression (simplified - assumes arrow function)
    const match = fnStr.match(/=>\s*(.+)$/s);
    this._readyPredicate = match ? match[1]!.trim() : 'true';
    return this;
  }

  timeout(duration: Duration): this {
    this._timeout = parseDuration(duration);
    return this;
  }

  done(predicate: (task: Task) => boolean): this {
    // Store done predicate if needed
    return this;
  }

  examples(...tasks: TaskBuilder[]): this {
    this._examples.push(...tasks);
    return this;
  }

  build(): CompiledQueue {
    return {
      name: this._name,
      readyPredicate: this._readyPredicate,
      timeout: this._timeout,
    };
  }
}

export function queue(name: string): QueueBuilder {
  return new QueueBuilder(name);
}
```

**Step 4: Implement gate.ts** (3 min)

```typescript
// packages/dsl/src/builders/gate.ts
import { CompiledGate, Correction } from '../types/compiled.js';
import { Context } from '../types/context.js';
import { AgentBuilder } from './agent.js';

export class GateBuilder {
  private _name: string;
  private _requires: string[] = [];
  private _onFail?: Correction;
  private _onFailFinal?: Correction;

  constructor(name: string) {
    this._name = name;
  }

  requires(check: (ctx: Context) => Promise<boolean> | boolean): this {
    // Convert function to string representation
    const fnStr = check.toString();
    this._requires.push(fnStr);
    return this;
  }

  onFail(correction: Correction): this {
    this._onFail = correction;
    return this;
  }

  onFailFinal(correction: Correction): this {
    this._onFailFinal = correction;
    return this;
  }

  build(): CompiledGate {
    return {
      name: this._name,
      requires: this._requires,
      onFail: this._onFail,
      onFailFinal: this._onFailFinal,
    };
  }
}

export function gate(name: string): GateBuilder {
  return new GateBuilder(name);
}
```

**Step 5: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/queue.test.ts
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): implement QueueBuilder and GateBuilder"
```

---

### Task 8: Implement TaskBuilder

**Files:**
- Create: `packages/dsl/src/builders/task.ts`
- Create: `packages/dsl/src/builders/task.test.ts`

**Step 1: Write failing test** (2 min)

```typescript
// packages/dsl/src/builders/task.test.ts
import { describe, it, expect } from 'vitest';
import { task } from './task.js';

describe('TaskBuilder', () => {
  it('creates task with id', () => {
    const t = task('setup');
    expect(t.build().id).toBe('setup');
  });

  it('sets files', () => {
    const t = task('setup').files('src/setup.ts', 'tests/setup.test.ts');
    expect(t.build().files).toEqual(['src/setup.ts', 'tests/setup.test.ts']);
  });

  it('sets dependencies', () => {
    const t = task('feature').depends('setup', 'config');
    expect(t.build().dependencies).toEqual(['setup', 'config']);
  });

  it('chains all options', () => {
    const t = task('auth')
      .files('src/auth.ts')
      .depends('setup')
      .instructions('Implement authentication')
      .success('All tests pass');

    const built = t.build();
    expect(built.id).toBe('auth');
    expect(built.files).toEqual(['src/auth.ts']);
    expect(built.dependencies).toEqual(['setup']);
    expect(built.instructions).toBe('Implement authentication');
    expect(built.success).toBe('All tests pass');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/task.test.ts
```

Expected: FAIL

**Step 3: Implement task.ts** (3 min)

```typescript
// packages/dsl/src/builders/task.ts
export interface TaskDefinition {
  id: string;
  description?: string;
  files: string[];
  dependencies: string[];
  instructions?: string;
  success?: string;
  wave?: number;
}

export class TaskBuilder {
  private _id: string;
  private _description?: string;
  private _files: string[] = [];
  private _dependencies: string[] = [];
  private _instructions?: string;
  private _success?: string;
  private _wave?: number;

  constructor(id: string) {
    this._id = id;
  }

  description(desc: string): this {
    this._description = desc;
    return this;
  }

  files(...paths: string[]): this {
    this._files.push(...paths);
    return this;
  }

  depends(...taskIds: string[]): this {
    this._dependencies.push(...taskIds);
    return this;
  }

  instructions(text: string): this {
    this._instructions = text;
    return this;
  }

  success(criteria: string): this {
    this._success = criteria;
    return this;
  }

  wave(waveNumber: number): this {
    this._wave = waveNumber;
    return this;
  }

  build(): TaskDefinition {
    return {
      id: this._id,
      description: this._description,
      files: this._files,
      dependencies: this._dependencies,
      instructions: this._instructions,
      success: this._success,
      wave: this._wave,
    };
  }
}

export function task(id: string): TaskBuilder {
  return new TaskBuilder(id);
}
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/task.test.ts
```

Expected: PASS (4 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): implement TaskBuilder for queue examples"
```

---

### Task 9: Implement PhaseBuilder

**Files:**
- Create: `packages/dsl/src/builders/phase.ts`
- Create: `packages/dsl/src/builders/phase.test.ts`

**Step 1: Write failing test** (3 min)

```typescript
// packages/dsl/src/builders/phase.test.ts
import { describe, it, expect } from 'vitest';
import { PhaseBuilder } from './phase.js';
import { agent } from './agent.js';

describe('PhaseBuilder', () => {
  const mockWorkflow = {
    addPhase: () => {},
    phase: () => new PhaseBuilder('test', {} as any),
    build: () => ({} as any),
  };

  it('creates phase with name', () => {
    const p = new PhaseBuilder('explore', mockWorkflow as any);
    expect(p.build().name).toBe('explore');
  });

  it('sets agent', () => {
    const orch = agent('orchestrator').model('opus');
    const p = new PhaseBuilder('explore', mockWorkflow as any).agent(orch);
    expect(p.build().agent).toBe('orchestrator');
  });

  it('sets expects and forbids', () => {
    const p = new PhaseBuilder('explore', mockWorkflow as any)
      .expects('Read', 'Grep')
      .forbids('Write', 'Edit');

    const built = p.build();
    expect(built.expects).toEqual(['Read', 'Grep']);
    expect(built.forbids).toEqual(['Write', 'Edit']);
  });

  it('sets outputs and requires', () => {
    const p = new PhaseBuilder('plan', mockWorkflow as any)
      .requires('architecture.md')
      .output('plan.md', 'tasks.md');

    const built = p.build();
    expect(built.requires).toEqual(['architecture.md']);
    expect(built.outputs).toEqual(['plan.md', 'tasks.md']);
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/phase.test.ts
```

Expected: FAIL

**Step 3: Implement phase.ts** (5 min)

```typescript
// packages/dsl/src/builders/phase.ts
import { CompiledPhase, Checkpoint } from '../types/compiled.js';
import { AgentBuilder } from './agent.js';
import { QueueBuilder } from './queue.js';
import { GateBuilder } from './gate.js';

// Forward reference type for WorkflowBuilder
interface WorkflowBuilderLike {
  phase(name: string): PhaseBuilder;
  build(): unknown;
}

export class PhaseBuilder {
  private _name: string;
  private _workflow: WorkflowBuilderLike;
  private _agent?: string;
  private _queue?: string;
  private _expects: string[] = [];
  private _forbids: string[] = [];
  private _requires: string[] = [];
  private _outputs: string[] = [];
  private _populates?: string;
  private _parallel: boolean | number = false;
  private _gate?: string;
  private _then?: string;
  private _checkpoint?: Checkpoint;

  constructor(name: string, workflow: WorkflowBuilderLike) {
    this._name = name;
    this._workflow = workflow;
  }

  agent(agent: AgentBuilder): this {
    this._agent = agent.build().name;
    return this;
  }

  queue(queue: QueueBuilder): this {
    this._queue = queue.build().name;
    return this;
  }

  expects(...tools: string[]): this {
    this._expects.push(...tools);
    return this;
  }

  forbids(...tools: string[]): this {
    this._forbids.push(...tools);
    return this;
  }

  requires(...artifacts: string[]): this {
    this._requires.push(...artifacts);
    return this;
  }

  output(...artifacts: string[]): this {
    this._outputs.push(...artifacts);
    return this;
  }

  populates(queue: QueueBuilder): this {
    this._populates = queue.build().name;
    return this;
  }

  parallel(count?: number): this {
    this._parallel = count ?? true;
    return this;
  }

  gate(gate: GateBuilder): this {
    this._gate = gate.build().name;
    return this;
  }

  then(queue: QueueBuilder): this {
    this._then = queue.build().name;
    return this;
  }

  checkpoint(checkpoint: Checkpoint): this {
    this._checkpoint = checkpoint;
    return this;
  }

  // Allow chaining back to workflow
  phase(name: string): PhaseBuilder {
    return this._workflow.phase(name);
  }

  build(): CompiledPhase {
    return {
      name: this._name,
      agent: this._agent ?? '',
      queue: this._queue,
      expects: this._expects,
      forbids: this._forbids,
      requires: this._requires,
      outputs: this._outputs,
      populates: this._populates,
      parallel: this._parallel,
      gate: this._gate,
      then: this._then,
      checkpoint: this._checkpoint,
    };
  }
}
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/phase.test.ts
```

Expected: PASS (4 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): implement PhaseBuilder for workflow phases"
```

---

### Task 10: Implement WorkflowBuilder

**Files:**
- Create: `packages/dsl/src/builders/workflow.ts`
- Create: `packages/dsl/src/builders/workflow.test.ts`

**Step 1: Write failing test** (3 min)

```typescript
// packages/dsl/src/builders/workflow.test.ts
import { describe, it, expect } from 'vitest';
import { workflow } from './workflow.js';
import { agent } from './agent.js';
import { queue } from './queue.js';

describe('WorkflowBuilder', () => {
  it('creates workflow with name', () => {
    const w = workflow('feature').build();
    expect(w.name).toBe('feature');
  });

  it('sets resumable', () => {
    const w = workflow('feature').resumable().build();
    expect(w.resumable).toBe(true);
  });

  it('sets orchestrator', () => {
    const orch = agent('orchestrator').model('opus');
    const w = workflow('feature').orchestrator(orch).build();
    expect(w.orchestrator).toBe('orchestrator');
  });

  it('chains phases fluently', () => {
    const orch = agent('orchestrator').model('opus');
    const tasks = queue('tasks');

    const w = workflow('feature')
      .orchestrator(orch)
      .phase('explore')
        .agent(orch)
        .expects('Read', 'Grep')
        .forbids('Write')
      .phase('plan')
        .agent(orch)
        .populates(tasks)
      .build();

    expect(w.phases).toHaveLength(2);
    expect(w.phases[0]!.name).toBe('explore');
    expect(w.phases[1]!.name).toBe('plan');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/workflow.test.ts
```

Expected: FAIL

**Step 3: Implement workflow.ts** (5 min)

```typescript
// packages/dsl/src/builders/workflow.ts
import { CompiledWorkflow, CompiledAgent, CompiledQueue, CompiledGate } from '../types/compiled.js';
import { AgentBuilder } from './agent.js';
import { QueueBuilder } from './queue.js';
import { GateBuilder } from './gate.js';
import { PhaseBuilder } from './phase.js';

interface ResumeOptions {
  onResume?: 'continue' | 'restart';
}

export class WorkflowBuilder {
  private _name: string;
  private _resumable: boolean = false;
  private _resumeOptions?: ResumeOptions;
  private _orchestrator?: AgentBuilder;
  private _phases: PhaseBuilder[] = [];
  private _currentPhase: PhaseBuilder | null = null;
  private _agents: Map<string, AgentBuilder> = new Map();
  private _queues: Map<string, QueueBuilder> = new Map();
  private _gates: Map<string, GateBuilder> = new Map();

  constructor(name: string) {
    this._name = name;
  }

  resumable(options?: ResumeOptions): this {
    this._resumable = true;
    this._resumeOptions = options;
    return this;
  }

  orchestrator(agent: AgentBuilder): this {
    this._orchestrator = agent;
    this._agents.set(agent.build().name, agent);
    return this;
  }

  phase(name: string): PhaseBuilder {
    // Finalize previous phase if any
    if (this._currentPhase) {
      this._phases.push(this._currentPhase);
    }
    // Create new phase with back-reference to this workflow
    this._currentPhase = new PhaseBuilder(name, this);
    return this._currentPhase;
  }

  // Internal: register an agent
  registerAgent(agent: AgentBuilder): void {
    this._agents.set(agent.build().name, agent);
  }

  // Internal: register a queue
  registerQueue(queue: QueueBuilder): void {
    this._queues.set(queue.build().name, queue);
  }

  // Internal: register a gate
  registerGate(gate: GateBuilder): void {
    this._gates.set(gate.build().name, gate);
  }

  build(): CompiledWorkflow {
    // Finalize last phase
    if (this._currentPhase) {
      this._phases.push(this._currentPhase);
    }

    // Validate
    this.validate();

    // Compile agents
    const agents: Record<string, CompiledAgent> = {};
    for (const [name, builder] of this._agents) {
      agents[name] = builder.build();
    }

    // Compile queues
    const queues: Record<string, CompiledQueue> = {};
    for (const [name, builder] of this._queues) {
      queues[name] = builder.build();
    }

    // Compile gates
    const gates: Record<string, CompiledGate> = {};
    for (const [name, builder] of this._gates) {
      gates[name] = builder.build();
    }

    return {
      name: this._name,
      resumable: this._resumable,
      orchestrator: this._orchestrator?.build().name ?? '',
      agents,
      phases: this._phases.map((p) => p.build()),
      queues,
      gates,
    };
  }

  private validate(): void {
    if (!this._orchestrator) {
      throw new Error('Workflow must have an orchestrator');
    }
    if (this._phases.length === 0) {
      throw new Error('Workflow must have at least one phase');
    }

    // Check for duplicate phase names
    const names = new Set<string>();
    for (const phase of this._phases) {
      const name = phase.build().name;
      if (names.has(name)) {
        throw new Error(`Duplicate phase name: ${name}`);
      }
      names.add(name);
    }
  }
}

export function workflow(name: string): WorkflowBuilder {
  return new WorkflowBuilder(name);
}
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/builders/workflow.test.ts
```

Expected: PASS (4 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): implement WorkflowBuilder with fluent phase chaining"
```

---

## Phase 4: DSL Invariants and Corrections

### Task 11: Implement Invariant Definitions

**Files:**
- Create: `packages/dsl/src/invariants/index.ts`
- Create: `packages/dsl/src/invariants/tdd.ts`
- Create: `packages/dsl/src/invariants/invariants.test.ts`

**Step 1: Write failing test** (2 min)

```typescript
// packages/dsl/src/invariants/invariants.test.ts
import { describe, it, expect } from 'vitest';
import { inv } from './index.js';

describe('inv.tdd', () => {
  it('creates TDD invariant', () => {
    const invariant = inv.tdd({
      test: '**/*.test.ts',
      impl: 'src/**/*.ts',
      order: ['test', 'impl'],
    });

    expect(invariant.type).toBe('tdd');
    expect(invariant.options).toEqual({
      test: '**/*.test.ts',
      impl: 'src/**/*.ts',
      order: ['test', 'impl'],
    });
  });
});

describe('inv.fileScope', () => {
  it('creates fileScope invariant', () => {
    const invariant = inv.fileScope((ctx) => ctx.task!.files);
    expect(invariant.type).toBe('fileScope');
  });
});

describe('inv.noCode', () => {
  it('creates noCode invariant', () => {
    const invariant = inv.noCode();
    expect(invariant.type).toBe('noCode');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/invariants/invariants.test.ts
```

Expected: FAIL

**Step 3: Implement invariants** (5 min)

```typescript
// packages/dsl/src/invariants/tdd.ts
import { CompiledInvariant } from '../types/compiled.js';
import { GlobPattern } from '../types/primitives.js';

export interface TddOptions {
  test: GlobPattern;
  impl: GlobPattern;
  order?: ('test' | 'impl')[];
  commit?: ('test' | 'impl')[];
}

export function tdd(options: TddOptions): CompiledInvariant {
  return {
    type: 'tdd',
    options: {
      test: options.test,
      impl: options.impl,
      order: options.order ?? ['test', 'impl'],
      commit: options.commit,
    },
  };
}
```

```typescript
// packages/dsl/src/invariants/index.ts
import { CompiledInvariant } from '../types/compiled.js';
import { Context } from '../types/context.js';
import { Duration, parseDuration } from '../types/primitives.js';
import { tdd, TddOptions } from './tdd.js';

export const inv = {
  tdd(options: TddOptions): CompiledInvariant {
    return tdd(options);
  },

  fileScope(getter: (ctx: Context) => string[]): CompiledInvariant {
    return {
      type: 'fileScope',
      options: {
        getter: getter.toString(),
      },
    };
  },

  noCode(): CompiledInvariant {
    return {
      type: 'noCode',
    };
  },

  readOnly(): CompiledInvariant {
    return {
      type: 'readOnly',
    };
  },

  mustReport(format: string): CompiledInvariant {
    return {
      type: 'mustReport',
      options: { format },
    };
  },

  mustProgress(timeout: Duration): CompiledInvariant {
    return {
      type: 'mustProgress',
      options: { timeout: parseDuration(timeout) },
    };
  },

  externalTodo(options: { file: string; checkBeforeStop: boolean }): CompiledInvariant {
    return {
      type: 'externalTodo',
      options,
    };
  },

  contextLimit(options: { max: number; warn?: number }): CompiledInvariant {
    return {
      type: 'contextLimit',
      options,
    };
  },
};
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/invariants/invariants.test.ts
```

Expected: PASS (3 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): implement invariant definitions (tdd, fileScope, noCode, etc.)"
```

---

### Task 12: Implement Correction Definitions

**Files:**
- Create: `packages/dsl/src/corrections/index.ts`
- Create: `packages/dsl/src/corrections/corrections.test.ts`

**Step 1: Write failing test** (2 min)

```typescript
// packages/dsl/src/corrections/corrections.test.ts
import { describe, it, expect } from 'vitest';
import { correct } from './index.js';

describe('correct.prompt', () => {
  it('creates prompt correction', () => {
    const c = correct.prompt('Write tests first.');
    expect(c.type).toBe('prompt');
    expect(c.message).toBe('Write tests first.');
  });
});

describe('correct chaining', () => {
  it('chains corrections with then()', () => {
    const c = correct
      .prompt('Fix the issue.')
      .then(correct.restart())
      .then(correct.escalate('orchestrator'));

    expect(c.type).toBe('prompt');
    expect(c.then?.type).toBe('restart');
    expect(c.then?.then?.type).toBe('escalate');
    expect(c.then?.then?.to).toBe('orchestrator');
  });
});

describe('correct.retry', () => {
  it('creates retry with options', () => {
    const c = correct.retry({ max: 3, backoff: 1000 });
    expect(c.type).toBe('retry');
    expect(c.max).toBe(3);
    expect(c.backoff).toBe(1000);
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/corrections/corrections.test.ts
```

Expected: FAIL

**Step 3: Implement corrections** (4 min)

```typescript
// packages/dsl/src/corrections/index.ts
import { Correction } from '../types/compiled.js';

// Chainable correction type
interface ChainableCorrection extends Correction {
  then(next: Correction): ChainableCorrection;
}

function makeChainable(correction: Correction): ChainableCorrection {
  return {
    ...correction,
    then(next: Correction): ChainableCorrection {
      // Find the end of the chain and append
      let current = correction;
      while (current.then) {
        current = current.then;
      }
      current.then = next;
      return makeChainable(correction);
    },
  };
}

export const correct = {
  prompt(message: string): ChainableCorrection {
    return makeChainable({
      type: 'prompt',
      message,
    });
  },

  warn(message: string): ChainableCorrection {
    return makeChainable({
      type: 'warn',
      message,
    });
  },

  block(message?: string): ChainableCorrection {
    return makeChainable({
      type: 'block',
      message,
    });
  },

  restart(): ChainableCorrection {
    return makeChainable({
      type: 'restart',
    });
  },

  reassign(): ChainableCorrection {
    return makeChainable({
      type: 'reassign',
    });
  },

  retry(options: { max: number; backoff?: number }): ChainableCorrection {
    return makeChainable({
      type: 'retry',
      max: options.max,
      backoff: options.backoff,
    });
  },

  escalate(to: 'orchestrator' | 'human'): ChainableCorrection {
    return makeChainable({
      type: 'escalate',
      to,
    });
  },

  compact(options: { preserve: string[]; discard?: string[] }): ChainableCorrection {
    return makeChainable({
      type: 'compact',
      preserveTypes: options.preserve,
    });
  },
};
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/corrections/corrections.test.ts
```

Expected: PASS (3 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): implement correction definitions with fluent chaining"
```

---

### Task 13: Implement Human Checkpoints

**Files:**
- Create: `packages/dsl/src/checkpoints/human.ts`
- Create: `packages/dsl/src/checkpoints/human.test.ts`

**Step 1: Write failing test** (2 min)

```typescript
// packages/dsl/src/checkpoints/human.test.ts
import { describe, it, expect } from 'vitest';
import { human } from './human.js';

describe('human.approval', () => {
  it('creates basic approval checkpoint', () => {
    const cp = human.approval();
    expect(cp.type).toBe('approval');
    expect(cp.id).toBeDefined();
  });

  it('creates approval with question', () => {
    const cp = human.approval('Ready to merge?');
    expect(cp.question).toBe('Ready to merge?');
  });

  it('creates approval with options', () => {
    const cp = human.approval({
      question: 'Proceed?',
      timeout: 300000,
      onTimeout: 'abort',
    });
    expect(cp.question).toBe('Proceed?');
    expect(cp.timeout).toBe(300000);
    expect(cp.onTimeout).toBe('abort');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/checkpoints/human.test.ts
```

Expected: FAIL

**Step 3: Implement human checkpoints** (3 min)

```typescript
// packages/dsl/src/checkpoints/human.ts
import { Checkpoint } from '../types/compiled.js';
import { randomUUID } from 'node:crypto';

interface ApprovalOptions {
  question?: string;
  timeout?: number;
  onTimeout?: 'abort' | 'continue' | 'escalate';
}

export const human = {
  approval(questionOrOptions?: string | ApprovalOptions): Checkpoint {
    const id = randomUUID();

    if (typeof questionOrOptions === 'string') {
      return {
        id,
        type: 'approval',
        question: questionOrOptions,
      };
    }

    if (questionOrOptions) {
      return {
        id,
        type: 'approval',
        question: questionOrOptions.question,
        timeout: questionOrOptions.timeout,
        onTimeout: questionOrOptions.onTimeout,
      };
    }

    return {
      id,
      type: 'approval',
    };
  },
};
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/dsl/src/checkpoints/human.test.ts
```

Expected: PASS (3 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(dsl): implement human checkpoint definitions"
```

---

## Phase 5: Daemon Core Types

### Task 14: Implement Daemon State Types

**Files:**
- Create: `packages/daemon/src/types/state.ts`
- Create: `packages/daemon/src/types/state.test.ts`

**Step 1: Write failing test** (2 min)

```typescript
// packages/daemon/src/types/state.test.ts
import { describe, it, expect } from 'vitest';
import { TaskStateSchema, WorkflowStateSchema, TaskStatus } from './state.js';

describe('TaskState', () => {
  it('validates valid task state', () => {
    const result = TaskStateSchema.safeParse({
      id: 'T001',
      description: 'Setup project',
      status: 'pending',
      dependencies: ['T000'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty task id', () => {
    const result = TaskStateSchema.safeParse({
      id: '',
      description: 'Setup project',
      status: 'pending',
    });
    expect(result.success).toBe(false);
  });
});

describe('WorkflowState', () => {
  it('validates workflow with tasks', () => {
    const result = WorkflowStateSchema.safeParse({
      workflowId: 'wf-123',
      workflowName: 'feature',
      startedAt: Date.now(),
      currentPhase: 'implement',
      tasks: {
        'T001': {
          id: 'T001',
          description: 'Setup',
          status: 'completed',
        },
      },
    });
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/types/state.test.ts
```

Expected: FAIL

**Step 3: Implement state types** (5 min)

```typescript
// packages/daemon/src/types/state.ts
import { z } from 'zod';

// Task status enum
export const TaskStatus = {
  PENDING: 'pending',
  CLAIMED: 'claimed',
  RUNNING: 'running',
  VERIFYING: 'verifying',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];

// Task state schema
export const TaskStateSchema = z.object({
  id: z.string().min(1, 'Task ID cannot be empty'),
  description: z.string(),
  instructions: z.string().optional(),
  success: z.string().optional(),
  status: z.enum(['pending', 'claimed', 'running', 'verifying', 'completed', 'failed']),
  claimedBy: z.string().nullable().default(null),
  claimedAt: z.number().nullable().default(null),
  startedAt: z.number().nullable().default(null),
  completedAt: z.number().nullable().default(null),
  attempts: z.number().default(0),
  lastError: z.string().nullable().default(null),
  dependencies: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  role: z.string().optional(),
  model: z.string().optional(),
  priority: z.number().optional(),
  timeoutSeconds: z.number().default(600),
});

export type TaskState = z.infer<typeof TaskStateSchema>;

// Queue state schema
export const QueueStateSchema = z.object({
  tasks: z.record(z.string(), TaskStateSchema),
});

export type QueueState = z.infer<typeof QueueStateSchema>;

// Agent state schema
export const AgentStateSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(['idle', 'active', 'stopped']),
  currentTask: z.string().nullable().default(null),
  pid: z.number().nullable().default(null),
  sessionId: z.string().nullable().default(null),
  lastHeartbeat: z.number().nullable().default(null),
  violationCounts: z.record(z.string(), z.number()).default({}),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

// Phase transition schema
export const PhaseTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  timestamp: z.number(),
});

export type PhaseTransition = z.infer<typeof PhaseTransitionSchema>;

// Checkpoint state schema
export const CheckpointStateSchema = z.object({
  id: z.string(),
  passed: z.boolean(),
  passedAt: z.number().nullable().default(null),
});

export type CheckpointState = z.infer<typeof CheckpointStateSchema>;

// Full workflow state schema
export const WorkflowStateSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  startedAt: z.number(),
  currentPhase: z.string(),
  phaseHistory: z.array(PhaseTransitionSchema).default([]),
  tasks: z.record(z.string(), TaskStateSchema).default({}),
  agents: z.record(z.string(), AgentStateSchema).default({}),
  checkpoints: z.record(z.string(), CheckpointStateSchema).default({}),
  pendingHumanActions: z.array(z.unknown()).default([]),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// Claim result for task claiming
export const ClaimResultSchema = z.object({
  task: TaskStateSchema.nullable(),
  isRetry: z.boolean().default(false),
  isReclaim: z.boolean().default(false),
});

export type ClaimResult = z.infer<typeof ClaimResultSchema>;
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/types/state.test.ts
```

Expected: PASS (2 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(daemon): implement state types with Zod schemas"
```

---

### Task 15: Implement IPC Protocol Types

**Files:**
- Create: `packages/daemon/src/types/ipc.ts`
- Create: `packages/daemon/src/types/trajectory.ts`

**Step 1: Create IPC types** (5 min)

```typescript
// packages/daemon/src/types/ipc.ts
import { z } from 'zod';

// Request types (discriminated union)
export const GetStateRequestSchema = z.object({
  command: z.literal('get_state'),
});

export const StatusRequestSchema = z.object({
  command: z.literal('status'),
  eventCount: z.number().optional().default(10),
});

export const PingRequestSchema = z.object({
  command: z.literal('ping'),
});

export const ShutdownRequestSchema = z.object({
  command: z.literal('shutdown'),
});

export const TaskClaimRequestSchema = z.object({
  command: z.literal('task_claim'),
  workerId: z.string().min(1),
});

export const TaskCompleteRequestSchema = z.object({
  command: z.literal('task_complete'),
  taskId: z.string().min(1),
  workerId: z.string().min(1),
  force: z.boolean().optional().default(false),
});

export const ExecRequestSchema = z.object({
  command: z.literal('exec'),
  args: z.array(z.string()).min(1),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeout: z.number().positive().optional(),
  exclusive: z.boolean().optional().default(false),
});

export const PlanImportRequestSchema = z.object({
  command: z.literal('plan_import'),
  content: z.string().min(1),
});

export const PlanResetRequestSchema = z.object({
  command: z.literal('plan_reset'),
});

// Union of all request types
export const IPCRequestSchema = z.discriminatedUnion('command', [
  GetStateRequestSchema,
  StatusRequestSchema,
  PingRequestSchema,
  ShutdownRequestSchema,
  TaskClaimRequestSchema,
  TaskCompleteRequestSchema,
  ExecRequestSchema,
  PlanImportRequestSchema,
  PlanResetRequestSchema,
]);

export type IPCRequest = z.infer<typeof IPCRequestSchema>;

// Response types
export const OkResponseSchema = z.object({
  status: z.literal('ok'),
  data: z.unknown(),
});

export const ErrorResponseSchema = z.object({
  status: z.literal('error'),
  message: z.string(),
});

export const IPCResponseSchema = z.discriminatedUnion('status', [
  OkResponseSchema,
  ErrorResponseSchema,
]);

export type IPCResponse = z.infer<typeof IPCResponseSchema>;

// Push events (daemon → clients)
export const StateChangedEventSchema = z.object({
  type: z.literal('state_changed'),
  state: z.unknown(),
});

export const TrajectoryEventPushSchema = z.object({
  type: z.literal('trajectory_event'),
  event: z.unknown(),
});

export const AgentOutputEventSchema = z.object({
  type: z.literal('agent_output'),
  agentId: z.string(),
  data: z.string(),
});

export const HumanRequiredEventSchema = z.object({
  type: z.literal('human_required'),
  checkpoint: z.unknown(),
});

export const IPCEventSchema = z.discriminatedUnion('type', [
  StateChangedEventSchema,
  TrajectoryEventPushSchema,
  AgentOutputEventSchema,
  HumanRequiredEventSchema,
]);

export type IPCEvent = z.infer<typeof IPCEventSchema>;
```

**Step 2: Create trajectory types** (3 min)

```typescript
// packages/daemon/src/types/trajectory.ts
import { z } from 'zod';

// Base event schema
const BaseEventSchema = z.object({
  timestamp: z.number(),
  agentId: z.string(),
});

// Tool use event
export const ToolUseEventSchema = BaseEventSchema.extend({
  type: z.literal('tool_use'),
  tool: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
  path: z.string().optional(),
});

export type ToolUseEvent = z.infer<typeof ToolUseEventSchema>;

// Tool result event
export const ToolResultEventSchema = BaseEventSchema.extend({
  type: z.literal('tool_result'),
  tool: z.string(),
  result: z.unknown(),
});

// Message event
export const MessageEventSchema = BaseEventSchema.extend({
  type: z.literal('message'),
  content: z.string(),
});

// Heartbeat event
export const HeartbeatEventSchema = BaseEventSchema.extend({
  type: z.literal('heartbeat'),
});

// Correction event
export const CorrectionEventSchema = BaseEventSchema.extend({
  type: z.literal('correction'),
  violation: z.object({
    type: z.string(),
    message: z.string().optional(),
  }),
  correction: z.object({
    type: z.string(),
    message: z.string().optional(),
  }),
});

export type CorrectionEvent = z.infer<typeof CorrectionEventSchema>;

// Spawn event
export const SpawnEventSchema = BaseEventSchema.extend({
  type: z.literal('spawn'),
  agentType: z.string(),
  taskId: z.string().nullable(),
  pid: z.number(),
  sessionId: z.string(),
});

export type SpawnEvent = z.infer<typeof SpawnEventSchema>;

// Phase transition event
export const PhaseTransitionEventSchema = z.object({
  type: z.literal('phase_transition'),
  timestamp: z.number(),
  from: z.string(),
  to: z.string(),
});

// Task claim event
export const TaskClaimEventSchema = BaseEventSchema.extend({
  type: z.literal('task_claim'),
  taskId: z.string(),
});

// Task complete event
export const TaskCompleteEventSchema = BaseEventSchema.extend({
  type: z.literal('task_complete'),
  taskId: z.string(),
});

// Union of all trajectory events
export const TrajectoryEventSchema = z.discriminatedUnion('type', [
  ToolUseEventSchema,
  ToolResultEventSchema,
  MessageEventSchema,
  HeartbeatEventSchema,
  CorrectionEventSchema,
  SpawnEventSchema,
  PhaseTransitionEventSchema,
  TaskClaimEventSchema,
  TaskCompleteEventSchema,
]);

export type TrajectoryEvent = z.infer<typeof TrajectoryEventSchema>;
```

**Step 3: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(daemon): implement IPC and trajectory types"
```

---

## Phase 6: Daemon State Manager

### Task 16: Implement StateManager

**Files:**
- Create: `packages/daemon/src/state/manager.ts`
- Create: `packages/daemon/src/state/manager.test.ts`

**Step 1: Write failing test** (3 min)

```typescript
// packages/daemon/src/state/manager.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from './manager.js';
import { TaskStatus } from '../types/state.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('StateManager', () => {
  let tempDir: string;
  let manager: StateManager;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));
    manager = new StateManager(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('returns null when no state file exists', async () => {
    const state = await manager.load();
    expect(state).toBeNull();
  });

  it('saves and loads state', async () => {
    const state = {
      workflowId: 'wf-1',
      workflowName: 'test',
      startedAt: Date.now(),
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'T001': {
          id: 'T001',
          description: 'Setup',
          status: TaskStatus.PENDING,
          claimedBy: null,
          claimedAt: null,
          startedAt: null,
          completedAt: null,
          attempts: 0,
          lastError: null,
          dependencies: [],
          files: [],
          timeoutSeconds: 600,
        },
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    };

    await manager.save(state);
    const loaded = await manager.load();

    expect(loaded).not.toBeNull();
    expect(loaded!.workflowId).toBe('wf-1');
    expect(loaded!.tasks['T001']!.description).toBe('Setup');
  });

  it('claims task atomically', async () => {
    // Setup initial state
    await manager.save({
      workflowId: 'wf-1',
      workflowName: 'test',
      startedAt: Date.now(),
      currentPhase: 'implement',
      phaseHistory: [],
      tasks: {
        'T001': {
          id: 'T001',
          description: 'Setup',
          status: TaskStatus.PENDING,
          claimedBy: null,
          claimedAt: null,
          startedAt: null,
          completedAt: null,
          attempts: 0,
          lastError: null,
          dependencies: [],
          files: [],
          timeoutSeconds: 600,
        },
      },
      agents: {},
      checkpoints: {},
      pendingHumanActions: [],
    });

    const result = await manager.claimTask('worker-1');
    expect(result.task).not.toBeNull();
    expect(result.task!.id).toBe('T001');
    expect(result.task!.claimedBy).toBe('worker-1');
    expect(result.task!.status).toBe(TaskStatus.RUNNING);
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/state/manager.test.ts
```

Expected: FAIL

**Step 3: Implement StateManager** (8 min)

```typescript
// packages/daemon/src/state/manager.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Mutex } from 'async-mutex';
import {
  WorkflowState,
  WorkflowStateSchema,
  TaskState,
  ClaimResult,
  TaskStatus,
} from '../types/state.js';

export class StateManager {
  private readonly worktreeRoot: string;
  private readonly stateFile: string;
  private readonly mutex: Mutex;
  private cachedState: WorkflowState | null = null;

  constructor(worktreeRoot: string) {
    this.worktreeRoot = worktreeRoot;
    this.stateFile = path.join(worktreeRoot, '.hyh', 'state.json');
    this.mutex = new Mutex();
  }

  async load(): Promise<WorkflowState | null> {
    return this.mutex.runExclusive(async () => {
      try {
        const content = await fs.readFile(this.stateFile, 'utf-8');
        const data = JSON.parse(content);
        this.cachedState = WorkflowStateSchema.parse(data);
        return this.cachedState;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          this.cachedState = null;
          return null;
        }
        throw error;
      }
    });
  }

  async save(state: WorkflowState): Promise<void> {
    return this.mutex.runExclusive(async () => {
      // Validate state
      const validated = WorkflowStateSchema.parse(state);

      // Ensure directory exists
      const dir = path.dirname(this.stateFile);
      await fs.mkdir(dir, { recursive: true });

      // Atomic write: temp file → fsync → rename
      const tempFile = `${this.stateFile}.tmp`;
      const content = JSON.stringify(validated, null, 2);

      const handle = await fs.open(tempFile, 'w');
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally {
        await handle.close();
      }

      await fs.rename(tempFile, this.stateFile);
      this.cachedState = validated;
    });
  }

  async claimTask(workerId: string): Promise<ClaimResult> {
    return this.mutex.runExclusive(async () => {
      if (!workerId || !workerId.trim()) {
        throw new Error('Worker ID cannot be empty');
      }

      const state = await this.loadInternal();
      if (!state) {
        return { task: null, isRetry: false, isReclaim: false };
      }

      // Find task for this worker (existing claim or new claimable)
      const task = this.getTaskForWorker(state, workerId);
      if (!task) {
        return { task: null, isRetry: false, isReclaim: false };
      }

      const wasMine = task.claimedBy === workerId;
      const isRetry = wasMine && task.status === TaskStatus.RUNNING;
      const isReclaim =
        !wasMine && task.status === TaskStatus.RUNNING && this.isTimedOut(task);

      // Update task
      const now = Date.now();
      const updatedTask: TaskState = {
        ...task,
        status: TaskStatus.RUNNING,
        claimedBy: workerId,
        startedAt: now,
        claimedAt: now,
      };

      // Update state
      const newState: WorkflowState = {
        ...state,
        tasks: {
          ...state.tasks,
          [task.id]: updatedTask,
        },
      };

      await this.saveInternal(newState);

      return { task: updatedTask, isRetry, isReclaim };
    });
  }

  async completeTask(taskId: string, workerId: string, force: boolean = false): Promise<void> {
    return this.mutex.runExclusive(async () => {
      const state = await this.loadInternal();
      if (!state) {
        throw new Error('No workflow state');
      }

      const task = state.tasks[taskId];
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      if (!force && task.claimedBy !== workerId) {
        throw new Error(
          `Task ${taskId} not owned by ${workerId} (owned by ${task.claimedBy ?? 'nobody'})`
        );
      }

      const updatedTask: TaskState = {
        ...task,
        status: TaskStatus.COMPLETED,
        completedAt: Date.now(),
      };

      const newState: WorkflowState = {
        ...state,
        tasks: {
          ...state.tasks,
          [taskId]: updatedTask,
        },
      };

      await this.saveInternal(newState);
    });
  }

  async reset(): Promise<void> {
    return this.mutex.runExclusive(async () => {
      try {
        await fs.unlink(this.stateFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      this.cachedState = null;
    });
  }

  // Internal methods (must be called within mutex)

  private async loadInternal(): Promise<WorkflowState | null> {
    if (this.cachedState) {
      return this.cachedState;
    }

    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      const data = JSON.parse(content);
      this.cachedState = WorkflowStateSchema.parse(data);
      return this.cachedState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async saveInternal(state: WorkflowState): Promise<void> {
    const validated = WorkflowStateSchema.parse(state);

    const dir = path.dirname(this.stateFile);
    await fs.mkdir(dir, { recursive: true });

    const tempFile = `${this.stateFile}.tmp`;
    const content = JSON.stringify(validated, null, 2);

    const handle = await fs.open(tempFile, 'w');
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }

    await fs.rename(tempFile, this.stateFile);
    this.cachedState = validated;
  }

  private getTaskForWorker(state: WorkflowState, workerId: string): TaskState | null {
    // First: check if worker has an existing running task
    for (const task of Object.values(state.tasks)) {
      if (task.status === TaskStatus.RUNNING && task.claimedBy === workerId) {
        return task;
      }
    }

    // Second: find a claimable task
    return this.getClaimableTask(state);
  }

  private getClaimableTask(state: WorkflowState): TaskState | null {
    // Find pending tasks with satisfied dependencies
    for (const task of Object.values(state.tasks)) {
      if (task.status === TaskStatus.PENDING && this.areDependenciesSatisfied(state, task)) {
        return task;
      }
    }

    // Find timed-out running tasks to reclaim
    for (const task of Object.values(state.tasks)) {
      if (
        task.status === TaskStatus.RUNNING &&
        this.isTimedOut(task) &&
        this.areDependenciesSatisfied(state, task)
      ) {
        return task;
      }
    }

    return null;
  }

  private areDependenciesSatisfied(state: WorkflowState, task: TaskState): boolean {
    for (const depId of task.dependencies) {
      const depTask = state.tasks[depId];
      if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
        return false;
      }
    }
    return true;
  }

  private isTimedOut(task: TaskState): boolean {
    if (task.status !== TaskStatus.RUNNING || !task.startedAt) {
      return false;
    }
    const elapsed = Date.now() - task.startedAt;
    return elapsed > task.timeoutSeconds * 1000;
  }
}
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/state/manager.test.ts
```

Expected: PASS (3 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(daemon): implement StateManager with atomic persistence"
```

---

## Phase 7: Daemon Trajectory Logger

### Task 17: Implement TrajectoryLogger

**Files:**
- Create: `packages/daemon/src/trajectory/logger.ts`
- Create: `packages/daemon/src/trajectory/logger.test.ts`

**Step 1: Write failing test** (2 min)

```typescript
// packages/daemon/src/trajectory/logger.test.ts
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
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/trajectory/logger.test.ts
```

Expected: FAIL

**Step 3: Implement TrajectoryLogger** (5 min)

```typescript
// packages/daemon/src/trajectory/logger.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

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
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
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
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
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
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }
}
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/trajectory/logger.test.ts
```

Expected: PASS (2 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(daemon): implement TrajectoryLogger for JSONL event logging"
```

---

## Phase 8: Daemon IPC Server

### Task 18: Implement IPC Server

**Files:**
- Create: `packages/daemon/src/ipc/server.ts`
- Create: `packages/daemon/src/ipc/server.test.ts`

**Step 1: Write failing test** (3 min)

```typescript
// packages/daemon/src/ipc/server.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IPCServer } from './server.js';
import * as net from 'node:net';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

describe('IPCServer', () => {
  let tempDir: string;
  let socketPath: string;
  let server: IPCServer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-ipc-'));
    socketPath = path.join(tempDir, 'test.sock');
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('starts and accepts connections', async () => {
    server = new IPCServer(socketPath);
    server.registerHandler('ping', async () => ({ running: true, pid: process.pid }));

    await server.start();

    // Connect as client
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    // Send ping request
    client.write(JSON.stringify({ command: 'ping' }) + '\n');

    // Read response
    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.running).toBe(true);

    client.end();
  });

  it('handles unknown commands with error', async () => {
    server = new IPCServer(socketPath);
    await server.start();

    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'unknown' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('error');

    client.end();
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/ipc/server.test.ts
```

Expected: FAIL

**Step 3: Implement IPC Server** (6 min)

```typescript
// packages/daemon/src/ipc/server.ts
import * as net from 'node:net';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import { IPCRequestSchema, IPCResponse } from '../types/ipc.js';

type RequestHandler = (request: unknown) => Promise<unknown>;

export class IPCServer extends EventEmitter {
  private readonly socketPath: string;
  private server: net.Server | null = null;
  private clients: Set<net.Socket> = new Set();
  private handlers: Map<string, RequestHandler> = new Map();

  constructor(socketPath: string) {
    super();
    this.socketPath = socketPath;
  }

  registerHandler(command: string, handler: RequestHandler): void {
    this.handlers.set(command, handler);
  }

  async start(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.socketPath), { recursive: true });

    // Remove stale socket
    try {
      await fs.unlink(this.socketPath);
    } catch {
      // Ignore if doesn't exist
    }

    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on('error', reject);

      this.server.listen(this.socketPath, () => {
        // Set socket permissions (read/write for owner only)
        fs.chmod(this.socketPath, 0o600).catch(() => {});
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    // Close all client connections
    for (const client of this.clients) {
      client.destroy();
    }
    this.clients.clear();

    // Close server
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          // Clean up socket file
          fs.unlink(this.socketPath).catch(() => {});
          resolve();
        });
      });
    }
  }

  broadcast(event: unknown): void {
    const message = JSON.stringify(event) + '\n';
    for (const client of this.clients) {
      client.write(message);
    }
  }

  private handleConnection(socket: net.Socket): void {
    this.clients.add(socket);

    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // Process complete messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line

      for (const line of lines) {
        if (line.trim()) {
          const response = await this.dispatch(line);
          socket.write(JSON.stringify(response) + '\n');
        }
      }
    });

    socket.on('close', () => {
      this.clients.delete(socket);
    });

    socket.on('error', (error) => {
      this.emit('error', error);
      this.clients.delete(socket);
    });
  }

  private async dispatch(raw: string): Promise<IPCResponse> {
    try {
      const data = JSON.parse(raw);
      const parseResult = IPCRequestSchema.safeParse(data);

      if (!parseResult.success) {
        return {
          status: 'error',
          message: `Invalid request: ${parseResult.error.message}`,
        };
      }

      const request = parseResult.data;
      const handler = this.handlers.get(request.command);

      if (!handler) {
        return {
          status: 'error',
          message: `Unknown command: ${request.command}`,
        };
      }

      const result = await handler(request);
      return {
        status: 'ok',
        data: result,
      };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/ipc/server.test.ts
```

Expected: PASS (2 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(daemon): implement IPC server with Unix socket"
```

---

## Phase 9: Daemon Core

### Task 19: Implement Core Daemon Class

**Files:**
- Create: `packages/daemon/src/core/daemon.ts`
- Create: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write failing test** (3 min)

```typescript
// packages/daemon/src/core/daemon.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Daemon } from './daemon.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as net from 'node:net';

describe('Daemon', () => {
  let tempDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-daemon-'));
  });

  afterEach(async () => {
    if (daemon) {
      await daemon.stop();
    }
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('starts and responds to ping', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    // Connect and send ping
    const socketPath = daemon.getSocketPath();
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'ping' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.running).toBe(true);

    client.end();
  });

  it('handles get_state when no workflow exists', async () => {
    daemon = new Daemon({ worktreeRoot: tempDir });
    await daemon.start();

    const socketPath = daemon.getSocketPath();
    const client = net.createConnection(socketPath);
    await new Promise<void>((resolve) => client.once('connect', resolve));

    client.write(JSON.stringify({ command: 'get_state' }) + '\n');

    const response = await new Promise<string>((resolve) => {
      client.once('data', (data) => resolve(data.toString()));
    });

    const parsed = JSON.parse(response.trim());
    expect(parsed.status).toBe('ok');
    expect(parsed.data.state).toBeNull();

    client.end();
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/core/daemon.test.ts
```

Expected: FAIL

**Step 3: Implement Daemon** (8 min)

```typescript
// packages/daemon/src/core/daemon.ts
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import * as os from 'node:os';
import { StateManager } from '../state/manager.js';
import { TrajectoryLogger } from '../trajectory/logger.js';
import { IPCServer } from '../ipc/server.js';
import { TaskStatus } from '../types/state.js';

interface DaemonOptions {
  worktreeRoot: string;
  socketPath?: string;
}

export class Daemon {
  private readonly worktreeRoot: string;
  private readonly socketPath: string;
  private readonly stateManager: StateManager;
  private readonly trajectory: TrajectoryLogger;
  private readonly ipcServer: IPCServer;
  private running: boolean = false;

  constructor(options: DaemonOptions) {
    this.worktreeRoot = options.worktreeRoot;

    // Generate socket path based on worktree hash
    const hash = crypto.createHash('sha256').update(this.worktreeRoot).digest('hex').slice(0, 16);
    this.socketPath =
      options.socketPath ?? path.join(os.homedir(), '.hyh', 'sockets', `${hash}.sock`);

    // Initialize components
    this.stateManager = new StateManager(this.worktreeRoot);
    this.trajectory = new TrajectoryLogger(path.join(this.worktreeRoot, '.hyh', 'trajectory.jsonl'));
    this.ipcServer = new IPCServer(this.socketPath);

    // Register handlers
    this.registerHandlers();
  }

  async start(): Promise<void> {
    await this.ipcServer.start();
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.ipcServer.stop();
  }

  getSocketPath(): string {
    return this.socketPath;
  }

  private registerHandlers(): void {
    // Ping
    this.ipcServer.registerHandler('ping', async () => ({
      running: true,
      pid: process.pid,
    }));

    // Get state
    this.ipcServer.registerHandler('get_state', async () => {
      const state = await this.stateManager.load();
      return { state };
    });

    // Status
    this.ipcServer.registerHandler('status', async (request: { eventCount?: number }) => {
      const state = await this.stateManager.load();
      const eventCount = request.eventCount ?? 10;

      if (!state) {
        return {
          active: false,
          summary: { total: 0, completed: 0, running: 0, pending: 0, failed: 0 },
          tasks: {},
          events: [],
          activeWorkers: [],
        };
      }

      const tasks = state.tasks;
      let completed = 0,
        running = 0,
        pending = 0,
        failed = 0;
      const activeWorkers: string[] = [];

      for (const task of Object.values(tasks)) {
        switch (task.status) {
          case TaskStatus.COMPLETED:
            completed++;
            break;
          case TaskStatus.RUNNING:
            running++;
            if (task.claimedBy) activeWorkers.push(task.claimedBy);
            break;
          case TaskStatus.PENDING:
            pending++;
            break;
          case TaskStatus.FAILED:
            failed++;
            break;
        }
      }

      const events = await this.trajectory.tail(eventCount);

      return {
        active: true,
        summary: {
          total: Object.keys(tasks).length,
          completed,
          running,
          pending,
          failed,
        },
        tasks,
        events,
        activeWorkers,
      };
    });

    // Task claim
    this.ipcServer.registerHandler('task_claim', async (request: { workerId: string }) => {
      const result = await this.stateManager.claimTask(request.workerId);

      if (result.task) {
        await this.trajectory.log({
          type: 'task_claim',
          timestamp: Date.now(),
          agentId: request.workerId,
          taskId: result.task.id,
          isRetry: result.isRetry,
          isReclaim: result.isReclaim,
        });
      }

      return {
        task: result.task,
        isRetry: result.isRetry,
        isReclaim: result.isReclaim,
      };
    });

    // Task complete
    this.ipcServer.registerHandler(
      'task_complete',
      async (request: { taskId: string; workerId: string; force?: boolean }) => {
        await this.stateManager.completeTask(request.taskId, request.workerId, request.force);

        await this.trajectory.log({
          type: 'task_complete',
          timestamp: Date.now(),
          agentId: request.workerId,
          taskId: request.taskId,
        });

        return { taskId: request.taskId };
      }
    );

    // Plan reset
    this.ipcServer.registerHandler('plan_reset', async () => {
      await this.stateManager.reset();

      await this.trajectory.log({
        type: 'plan_reset',
        timestamp: Date.now(),
      });

      return { message: 'Workflow state cleared' };
    });

    // Shutdown
    this.ipcServer.registerHandler('shutdown', async () => {
      // Schedule shutdown
      setTimeout(() => this.stop(), 100);
      return { shutdown: true };
    });
  }
}
```

**Step 4: Run tests** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm vitest run packages/daemon/src/core/daemon.test.ts
```

Expected: PASS (2 passed)

**Step 5: Commit** (30 sec)

```bash
git add -A && git commit -m "feat(daemon): implement core Daemon class with IPC handlers"
```

---

## Phase 10: Verification and Integration

### Task 20: Update Package Exports and Build

**Files:**
- Modify: `packages/dsl/src/index.ts`
- Modify: `packages/daemon/src/index.ts`

**Step 1: Update DSL exports** (2 min)

Verify all exports are properly connected by attempting to build:

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm -r build
```

**Step 2: Fix any missing exports** (3 min)

Create any missing barrel files needed for the build.

**Step 3: Run full test suite** (30 sec)

```bash
cd /Users/pedroproenca/Documents/Projects/hyh-ts && pnpm test
```

Expected: All tests pass

**Step 4: Commit** (30 sec)

```bash
git add -A && git commit -m "chore: fix exports and ensure build passes"
```

---

### Task 21: Code Review

**Files:** All implementation files

Review the complete implementation for:
- Type safety
- Error handling
- Test coverage
- Code organization
- Documentation

This task should use the code-reviewer agent.

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Monorepo foundation (must be first) |
| Group 2 | 2, 3 | Package scaffolds (independent) |
| Group 3 | 4, 5 | Core types (independent within DSL) |
| Group 4 | 6, 7, 8 | Builders (mostly independent) |
| Group 5 | 9, 10 | Phase and Workflow builders (workflow depends on phase) |
| Group 6 | 11, 12, 13 | Invariants, corrections, checkpoints (independent) |
| Group 7 | 14, 15 | Daemon types (independent) |
| Group 8 | 16, 17 | State and Trajectory (independent) |
| Group 9 | 18, 19 | IPC and Daemon core (IPC first, then daemon) |
| Group 10 | 20, 21 | Integration and review |

---

## Summary

This plan implements the hyh-ts TypeScript port in 21 tasks across 10 phases:

1. **Monorepo Foundation** (Tasks 1-3): pnpm workspaces, TypeScript config
2. **DSL Core Types** (Tasks 4-5): Primitives and compiled types
3. **DSL Builders** (Tasks 6-10): Agent, Queue, Gate, Task, Phase, Workflow
4. **DSL Invariants/Corrections** (Tasks 11-13): inv.*, correct.*, human.*
5. **Daemon Types** (Tasks 14-15): State and IPC schemas
6. **State Manager** (Task 16): Atomic persistence with mutex
7. **Trajectory Logger** (Task 17): JSONL event logging
8. **IPC Server** (Task 18): Unix socket JSON-RPC
9. **Core Daemon** (Task 19): Orchestration engine
10. **Integration** (Tasks 20-21): Build verification and review

**Estimated scope:** ~40 source files, ~3000 lines of code, ~800 lines of tests
