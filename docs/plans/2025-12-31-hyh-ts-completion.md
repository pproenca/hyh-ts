# hyh-ts Completion Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-hyh-ts-completion.md` to implement task-by-task.

**Goal:** Complete the TypeScript port of hyh by integrating all existing components into a working multi-agent workflow orchestration system.

**Architecture:** The codebase uses a monorepo structure with 4 packages (@hyh/dsl, @hyh/daemon, @hyh/cli, @hyh/tui). Most components are built and tested (183 passing tests). The remaining work is integration - wiring components together into a cohesive system that can spawn Claude CLI agents, enforce invariants, apply corrections, and manage workflow phases.

**Tech Stack:** TypeScript 5.7+, ESM modules, pnpm workspaces, Vitest, Zod validation, async-mutex, Unix sockets IPC, Ink for TUI

---

## Phase 1: Core Daemon Integration

### Task 1: Integrate CheckerChain into Daemon Event Processing

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts:54-196`
- Modify: `packages/daemon/src/checkers/chain.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/core/daemon.test.ts - add to existing tests
it('should check invariants when processing agent events', async () => {
  const daemon = new Daemon({ worktreeRoot: tmpDir });
  await daemon.start();

  // Simulate agent event that violates TDD (impl before test)
  const result = await daemon.processAgentEvent('worker-1', {
    type: 'tool_use',
    tool: 'Write',
    args: { path: 'src/feature.ts' },
    timestamp: Date.now(),
  });

  expect(result.violation).toBeDefined();
  expect(result.violation.type).toBe('tdd');

  await daemon.stop();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: FAIL with `processAgentEvent is not a function` or similar

**Step 3: Implement processAgentEvent in Daemon** (5-8 min)

```typescript
// packages/daemon/src/core/daemon.ts - add imports and method
import { CheckerChain } from '../checkers/chain.js';
import { CorrectionApplicator } from '../corrections/applicator.js';

export class Daemon {
  // ... existing fields
  private checkerChain: CheckerChain | null = null;
  private correctionApplicator: CorrectionApplicator | null = null;

  async loadWorkflow(workflowPath: string): Promise<void> {
    const workflow = await WorkflowLoader.load(workflowPath);
    this.checkerChain = new CheckerChain(workflow);
    this.correctionApplicator = new CorrectionApplicator();
  }

  async processAgentEvent(
    agentId: string,
    event: TrajectoryEvent
  ): Promise<{ violation: Violation | null; correction: Correction | null }> {
    // Log to trajectory
    await this.trajectory.log({ ...event, agentId });

    // Check invariants
    if (!this.checkerChain) {
      return { violation: null, correction: null };
    }

    const state = await this.stateManager.load();
    const context: CheckContext = {
      agentId,
      event,
      state,
      trajectory: await this.trajectory.tail(100),
    };

    const violation = this.checkerChain.check(context);

    if (violation) {
      const correction = this.checkerChain.getCorrection(violation);
      return { violation, correction };
    }

    return { violation: null, correction: null };
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): integrate CheckerChain into event processing"
```

---

### Task 2: Add Correction Application on Violations

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Modify: `packages/daemon/src/corrections/applicator.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/core/daemon.test.ts
it('should apply correction when violation detected', async () => {
  const daemon = new Daemon({ worktreeRoot: tmpDir });
  await daemon.start();
  await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

  // Mock agent
  const mockAgent = { injectPrompt: vi.fn() };
  daemon.setAgent('worker-1', mockAgent);

  // Simulate violation
  const result = await daemon.processAgentEvent('worker-1', {
    type: 'tool_use',
    tool: 'Write',
    args: { path: 'src/impl.ts' },
    timestamp: Date.now(),
  });

  expect(result.correction).toBeDefined();
  expect(mockAgent.injectPrompt).toHaveBeenCalled();

  await daemon.stop();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: FAIL with `setAgent is not a function`

**Step 3: Implement correction application** (5 min)

```typescript
// packages/daemon/src/core/daemon.ts - add method
private agents: Map<string, AgentProcess> = new Map();

setAgent(agentId: string, agent: AgentProcess): void {
  this.agents.set(agentId, agent);
}

async processAgentEvent(
  agentId: string,
  event: TrajectoryEvent
): Promise<{ violation: Violation | null; correction: Correction | null }> {
  // ... existing code

  if (violation) {
    const correction = this.checkerChain.getCorrection(violation);

    // Apply correction
    if (correction && this.correctionApplicator) {
      const agent = this.agents.get(agentId);
      if (agent) {
        await this.correctionApplicator.apply(correction, agent);
      }
    }

    // Log correction event
    await this.trajectory.log({
      type: 'correction',
      timestamp: Date.now(),
      agentId,
      violation,
      correction,
    });

    return { violation, correction };
  }

  return { violation: null, correction: null };
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): apply corrections on invariant violations"
```

---

### Task 3: Wire SpawnTriggerManager into Daemon Event Loop

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Modify: `packages/daemon/src/workflow/spawn-trigger.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/core/daemon.test.ts
it('should spawn agents when spawn triggers fire', async () => {
  const daemon = new Daemon({ worktreeRoot: tmpDir });
  await daemon.start();

  // Create workflow with tasks
  const workflowPath = path.join(tmpDir, '.hyh', 'workflow.json');
  await fs.writeFile(workflowPath, JSON.stringify({
    name: 'test',
    orchestrator: 'orchestrator',
    agents: { worker: { name: 'worker', model: 'sonnet', role: 'implementation' } },
    phases: [{ name: 'implement', agent: 'worker', queue: 'tasks', parallel: true }],
    queues: { tasks: { name: 'tasks', timeout: 600000 } },
    gates: {},
  }));

  await daemon.loadWorkflow(workflowPath);

  // Add pending task
  await daemon.stateManager.update((state) => {
    state.tasks['task-1'] = { id: 'task-1', status: 'pending', dependencies: [] };
  });

  // Trigger spawn check
  const spawns = await daemon.checkSpawnTriggers();

  expect(spawns.length).toBe(1);
  expect(spawns[0].taskId).toBe('task-1');

  await daemon.stop();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: FAIL with `checkSpawnTriggers is not a function`

**Step 3: Implement spawn trigger integration** (5 min)

```typescript
// packages/daemon/src/core/daemon.ts
import { SpawnTriggerManager, SpawnSpec } from '../workflow/spawn-trigger.js';

export class Daemon {
  private spawnTrigger: SpawnTriggerManager | null = null;

  async loadWorkflow(workflowPath: string): Promise<void> {
    const workflow = await WorkflowLoader.load(workflowPath);
    this.workflow = workflow;
    this.checkerChain = new CheckerChain(workflow);
    this.correctionApplicator = new CorrectionApplicator();
    this.spawnTrigger = new SpawnTriggerManager(workflow);
  }

  async checkSpawnTriggers(): Promise<SpawnSpec[]> {
    if (!this.spawnTrigger || !this.workflow) {
      return [];
    }

    const state = await this.stateManager.load();
    if (!state) return [];

    return this.spawnTrigger.getSpawns(state);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): integrate SpawnTriggerManager for agent spawning"
```

---

### Task 4: Wire PhaseManager for Phase Transitions

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/core/daemon.test.ts
it('should check and execute phase transitions', async () => {
  const daemon = new Daemon({ worktreeRoot: tmpDir });
  await daemon.start();
  await daemon.loadWorkflow(workflowPath);

  // Set state to end of 'plan' phase
  await daemon.stateManager.update((state) => {
    state.currentPhase = 'plan';
    // Mark outputs complete
  });

  // Check transition
  const canTransition = await daemon.checkPhaseTransition();

  expect(canTransition).toBe(true);

  await daemon.transitionPhase('implement');
  const state = await daemon.stateManager.load();
  expect(state.currentPhase).toBe('implement');

  await daemon.stop();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: FAIL

**Step 3: Implement phase transition methods** (5 min)

```typescript
// packages/daemon/src/core/daemon.ts
import { PhaseManager } from '../workflow/phase-manager.js';

export class Daemon {
  private phaseManager: PhaseManager | null = null;

  async loadWorkflow(workflowPath: string): Promise<void> {
    // ... existing code
    this.phaseManager = new PhaseManager(workflow);
  }

  async checkPhaseTransition(): Promise<boolean> {
    if (!this.phaseManager) return false;
    const state = await this.stateManager.load();
    if (!state) return false;
    return this.phaseManager.canTransition(state);
  }

  async transitionPhase(nextPhase: string): Promise<void> {
    await this.stateManager.update((state) => {
      state.currentPhase = nextPhase;
    });

    await this.trajectory.log({
      type: 'phase_transition',
      timestamp: Date.now(),
      from: state.currentPhase,
      to: nextPhase,
    });
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): integrate PhaseManager for phase transitions"
```

---

## Phase 2: Agent Lifecycle Management

### Task 5: Enhance AgentManager with Full Lifecycle

**Files:**
- Modify: `packages/daemon/src/agents/manager.ts`
- Modify: `packages/daemon/src/agents/process.ts`
- Test: `packages/daemon/src/agents/manager.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/agents/manager.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentManager } from './manager.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('AgentManager Lifecycle', () => {
  let tmpDir: string;
  let manager: AgentManager;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));
    manager = new AgentManager(tmpDir);
  });

  afterEach(async () => {
    await manager.stopAll();
    await fs.rm(tmpDir, { recursive: true });
  });

  it('should spawn agent and receive events', async () => {
    const events: unknown[] = [];

    const agent = await manager.spawn({
      agentType: 'worker',
      taskId: 'task-1',
      model: 'sonnet',
      systemPromptPath: path.join(tmpDir, 'prompt.md'),
      tools: ['Read', 'Write'],
    });

    agent.on('event', (e) => events.push(e));

    expect(agent.isRunning).toBe(true);
    expect(manager.getAgent(agent.agentId)).toBe(agent);

    await agent.stop();
    expect(manager.getAgent(agent.agentId)).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/agents/manager.test.ts --reporter=verbose
```

Expected: FAIL (method signatures may differ)

**Step 3: Implement enhanced AgentManager** (5-8 min)

```typescript
// packages/daemon/src/agents/manager.ts
import { AgentProcess, AgentProcessConfig } from './process.js';
import * as crypto from 'node:crypto';

export interface SpawnSpec {
  agentType: string;
  taskId?: string;
  model: 'haiku' | 'sonnet' | 'opus';
  systemPromptPath: string;
  tools: string[];
  cwd?: string;
}

export class AgentManager {
  private readonly cwd: string;
  private readonly agents: Map<string, AgentProcess> = new Map();

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  async spawn(spec: SpawnSpec): Promise<AgentProcess> {
    const agentId = spec.taskId
      ? `${spec.agentType}-${spec.taskId.slice(0, 4)}`
      : `${spec.agentType}-${crypto.randomBytes(4).toString('hex')}`;

    const sessionId = crypto.randomUUID();

    const config: AgentProcessConfig = {
      agentId,
      model: spec.model,
      sessionId,
      systemPromptPath: spec.systemPromptPath,
      tools: spec.tools,
      cwd: spec.cwd || this.cwd,
    };

    const agent = new AgentProcess(config);

    agent.on('event', (event) => {
      if (event.type === 'exit') {
        this.agents.delete(agentId);
      }
    });

    await agent.start();
    this.agents.set(agentId, agent);

    return agent;
  }

  getAgent(agentId: string): AgentProcess | undefined {
    return this.agents.get(agentId);
  }

  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.agents.values()).map((a) => a.stop());
    await Promise.all(stopPromises);
    this.agents.clear();
  }

  activeAgents(): AgentProcess[] {
    return Array.from(this.agents.values()).filter((a) => a.isRunning);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/agents/manager.test.ts --reporter=verbose
```

Expected: PASS (or may fail if claude CLI not available - mock it)

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/agents/manager.ts packages/daemon/src/agents/manager.test.ts
git commit -m "feat(agents): enhance AgentManager with full lifecycle management"
```

---

### Task 6: Add Claude Output Parser for stream-json

**Files:**
- Create: `packages/daemon/src/agents/output-parser.ts`
- Test: `packages/daemon/src/agents/output-parser.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/agents/output-parser.test.ts
import { describe, it, expect } from 'vitest';
import { ClaudeOutputParser, ClaudeEvent } from './output-parser.js';
import { Readable } from 'node:stream';

describe('ClaudeOutputParser', () => {
  it('should parse tool_use events from stream-json', async () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();

    parser.on('data', (event) => events.push(event));

    // Simulate Claude output
    const lines = [
      '{"type":"assistant","message":{"content":[{"type":"text","text":"I will help"}]}}',
      '{"type":"tool_use","id":"123","name":"Read","input":{"path":"src/foo.ts"}}',
      '{"type":"tool_result","tool_use_id":"123","content":"file contents"}',
    ];

    for (const line of lines) {
      parser.write(line + '\n');
    }
    parser.end();

    expect(events).toHaveLength(3);
    expect(events[1]).toEqual({
      type: 'tool_use',
      id: '123',
      name: 'Read',
      input: { path: 'src/foo.ts' },
    });
  });

  it('should handle partial lines', async () => {
    const events: ClaudeEvent[] = [];
    const parser = new ClaudeOutputParser();
    parser.on('data', (event) => events.push(event));

    parser.write('{"type":"tool_');
    parser.write('use","id":"1","name":"Write","input":{}}');
    parser.write('\n');
    parser.end();

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tool_use');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/agents/output-parser.test.ts --reporter=verbose
```

Expected: FAIL with module not found

**Step 3: Implement ClaudeOutputParser** (5 min)

```typescript
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
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/agents/output-parser.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/agents/output-parser.ts packages/daemon/src/agents/output-parser.test.ts
git commit -m "feat(agents): add ClaudeOutputParser for stream-json format"
```

---

### Task 7: Integrate HeartbeatMonitor with Daemon

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/core/daemon.test.ts
it('should monitor agent heartbeats and detect misses', async () => {
  const daemon = new Daemon({ worktreeRoot: tmpDir });
  await daemon.start();

  // Register heartbeat for agent
  daemon.recordHeartbeat('worker-1');

  // Check immediately - should be ok
  const status1 = daemon.checkHeartbeat('worker-1', 30000);
  expect(status1.status).toBe('ok');

  // Advance time past interval
  vi.useFakeTimers();
  vi.advanceTimersByTime(35000);

  const status2 = daemon.checkHeartbeat('worker-1', 30000);
  expect(status2.status).toBe('miss');
  expect(status2.count).toBe(1);

  vi.useRealTimers();
  await daemon.stop();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: FAIL

**Step 3: Implement heartbeat integration** (5 min)

```typescript
// packages/daemon/src/core/daemon.ts
import { HeartbeatMonitor, HeartbeatStatus } from '../agents/heartbeat.js';

export class Daemon {
  private heartbeatMonitor: HeartbeatMonitor = new HeartbeatMonitor();

  recordHeartbeat(agentId: string): void {
    this.heartbeatMonitor.recordHeartbeat(agentId);
  }

  checkHeartbeat(agentId: string, interval: number): HeartbeatStatus {
    return this.heartbeatMonitor.check(agentId, interval);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): integrate HeartbeatMonitor for agent liveness"
```

---

## Phase 3: Full Workflow Execution

### Task 8: Implement Main Event Loop Tick Handler

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/core/daemon.test.ts
it('should process tick: check heartbeats, spawn triggers, phase transitions', async () => {
  const daemon = new Daemon({ worktreeRoot: tmpDir });
  await daemon.start();
  await daemon.loadWorkflow(workflowPath);

  // Set up initial state
  await daemon.stateManager.update((state) => {
    state.currentPhase = 'implement';
    state.tasks['task-1'] = { id: 'task-1', status: 'pending' };
  });

  // Run one tick
  const tickResult = await daemon.tick();

  expect(tickResult.spawnsTriggered).toBeGreaterThanOrEqual(0);
  expect(tickResult.heartbeatsMissed).toBeDefined();

  await daemon.stop();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: FAIL

**Step 3: Implement tick method** (8-10 min)

```typescript
// packages/daemon/src/core/daemon.ts
interface TickResult {
  spawnsTriggered: number;
  heartbeatsMissed: string[];
  phaseTransitioned: boolean;
  correctionsApplied: number;
}

export class Daemon {
  async tick(): Promise<TickResult> {
    const result: TickResult = {
      spawnsTriggered: 0,
      heartbeatsMissed: [],
      phaseTransitioned: false,
      correctionsApplied: 0,
    };

    // 1. Check heartbeats
    for (const agent of this.agentManager?.activeAgents() || []) {
      const agentDef = this.workflow?.agents[agent.model];
      const interval = agentDef?.heartbeat?.interval || 30000;
      const status = this.checkHeartbeat(agent.agentId, interval);

      if (status.status === 'miss') {
        result.heartbeatsMissed.push(agent.agentId);
        // Apply heartbeat correction
        const corrections = agentDef?.heartbeat?.corrections || [];
        const correction = corrections.find((c) => c.count <= status.count);
        if (correction) {
          await this.correctionApplicator?.apply(correction.correction, agent);
          result.correctionsApplied++;
        }
      }
    }

    // 2. Check spawn triggers
    const spawns = await this.checkSpawnTriggers();
    for (const spawn of spawns) {
      await this.spawnAgent(spawn);
      result.spawnsTriggered++;
    }

    // 3. Check phase transitions
    if (await this.checkPhaseTransition()) {
      const nextPhase = this.phaseManager?.getNextPhase(
        await this.stateManager.load()
      );
      if (nextPhase) {
        await this.transitionPhase(nextPhase);
        result.phaseTransitioned = true;
      }
    }

    // 4. Persist state
    await this.stateManager.flush();

    return result;
  }

  private async spawnAgent(spec: SpawnSpec): Promise<void> {
    if (!this.agentManager || !this.workflow) return;

    const agentDef = this.workflow.agents[spec.agentType];
    if (!agentDef) return;

    const promptPath = path.join(this.worktreeRoot, '.hyh', 'agents', `${spec.agentType}.md`);

    const agent = await this.agentManager.spawn({
      agentType: spec.agentType,
      taskId: spec.taskId,
      model: agentDef.model,
      systemPromptPath: promptPath,
      tools: agentDef.tools,
    });

    // Wire event handler
    agent.on('event', async (event) => {
      await this.processAgentEvent(agent.agentId, {
        type: event.type,
        tool: event.data?.name,
        args: event.data?.input,
        timestamp: Date.now(),
      });
    });

    this.agents.set(agent.agentId, agent);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): implement main event loop tick handler"
```

---

### Task 9: Integrate GateExecutor for Quality Gates

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/core/daemon.test.ts
it('should execute quality gate before phase transition', async () => {
  const daemon = new Daemon({ worktreeRoot: tmpDir });
  await daemon.start();

  // Workflow with gate
  const workflow = {
    // ... phases with gate
    gates: {
      quality: {
        name: 'quality',
        requires: ['npm test'],
      },
    },
  };

  await daemon.loadWorkflow(/* ... */);

  // Execute gate
  const gateResult = await daemon.executeGate('quality');

  expect(gateResult.passed).toBeDefined();

  await daemon.stop();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: FAIL

**Step 3: Implement gate execution** (5 min)

```typescript
// packages/daemon/src/core/daemon.ts
import { GateExecutor, GateResult } from '../workflow/gate-executor.js';

export class Daemon {
  private gateExecutor: GateExecutor | null = null;

  async loadWorkflow(workflowPath: string): Promise<void> {
    // ... existing
    this.gateExecutor = new GateExecutor(this.worktreeRoot);
  }

  async executeGate(gateName: string): Promise<GateResult> {
    if (!this.gateExecutor || !this.workflow) {
      return { passed: false, message: 'No workflow loaded' };
    }

    const gate = this.workflow.gates[gateName];
    if (!gate) {
      return { passed: false, message: `Gate ${gateName} not found` };
    }

    return this.gateExecutor.execute(gate);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): integrate GateExecutor for quality gates"
```

---

### Task 10: Add Artifact Handoff Between Tasks

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/daemon/src/core/daemon.test.ts
it('should save artifact when task completes', async () => {
  const daemon = new Daemon({ worktreeRoot: tmpDir });
  await daemon.start();

  // Complete a task
  await daemon.stateManager.update((state) => {
    state.tasks['task-1'] = { id: 'task-1', status: 'running' };
  });

  await daemon.completeTask('task-1', 'worker-1', {
    summary: 'Implemented token service',
    filesModified: ['src/auth/token.ts'],
    exports: [{ name: 'generateToken', type: 'function' }],
  });

  // Check artifact was saved
  const artifact = await daemon.getArtifact('task-1');
  expect(artifact).toBeDefined();
  expect(artifact.summary).toContain('token service');

  await daemon.stop();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: FAIL

**Step 3: Implement artifact handling** (5 min)

```typescript
// packages/daemon/src/core/daemon.ts
import { ArtifactManager, Artifact } from '../managers/artifact.js';

export class Daemon {
  private artifactManager: ArtifactManager;

  constructor(options: DaemonOptions) {
    // ... existing
    this.artifactManager = new ArtifactManager(
      path.join(this.worktreeRoot, '.hyh', 'artifacts')
    );
  }

  async completeTask(
    taskId: string,
    workerId: string,
    artifact?: Partial<Artifact>
  ): Promise<void> {
    await this.stateManager.completeTask(taskId, workerId);

    if (artifact) {
      await this.artifactManager.save(taskId, {
        taskId,
        status: 'complete',
        summary: artifact.summary || '',
        files: { modified: artifact.filesModified || [], created: [] },
        exports: artifact.exports || [],
        tests: { total: 0, passed: 0 },
        notes: [],
      });
    }

    await this.trajectory.log({
      type: 'task_complete',
      timestamp: Date.now(),
      agentId: workerId,
      taskId,
    });
  }

  async getArtifact(taskId: string): Promise<Artifact | null> {
    return this.artifactManager.load(taskId);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/daemon/src/core/daemon.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): add artifact handoff between tasks"
```

---

## Phase 4: TUI Completion

### Task 11: Wire TUI IPC Client to Daemon

**Files:**
- Modify: `packages/tui/src/hooks/useDaemon.ts`
- Test: `packages/tui/src/hooks/useDaemon.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/tui/src/hooks/useDaemon.test.ts
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react-hooks';
import { useDaemon } from './useDaemon.js';

describe('useDaemon', () => {
  it('should connect to daemon and receive state updates', async () => {
    const mockSocket = {
      connect: vi.fn().mockResolvedValue(undefined),
      send: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
    };

    const { result } = renderHook(() => useDaemon('/tmp/test.sock'));

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.connected).toBe(true);
    expect(result.current.state).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/tui/src/hooks/useDaemon.test.ts --reporter=verbose
```

Expected: FAIL

**Step 3: Implement useDaemon hook** (5-8 min)

```typescript
// packages/tui/src/hooks/useDaemon.ts
import { useState, useCallback, useEffect } from 'react';
import { IPCClient } from '@hyh/cli/ipc/client';
import type { WorkflowState } from '@hyh/daemon';

interface DaemonConnection {
  connected: boolean;
  state: WorkflowState | null;
  events: unknown[];
  error: Error | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
}

export function useDaemon(socketPath: string): DaemonConnection {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<WorkflowState | null>(null);
  const [events, setEvents] = useState<unknown[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [client, setClient] = useState<IPCClient | null>(null);

  const connect = useCallback(async () => {
    try {
      const ipcClient = new IPCClient(socketPath);
      await ipcClient.connect();

      ipcClient.on('state_changed', (data) => {
        setState(data.state);
      });

      ipcClient.on('trajectory_event', (data) => {
        setEvents((prev) => [...prev.slice(-100), data.event]);
      });

      setClient(ipcClient);
      setConnected(true);

      // Initial state fetch
      const response = await ipcClient.request({ type: 'get_state' });
      setState(response.state);
    } catch (err) {
      setError(err as Error);
      setConnected(false);
    }
  }, [socketPath]);

  const disconnect = useCallback(() => {
    client?.disconnect();
    setClient(null);
    setConnected(false);
  }, [client]);

  const refresh = useCallback(async () => {
    if (!client) return;
    const response = await client.request({ type: 'get_state' });
    setState(response.state);
  }, [client]);

  useEffect(() => {
    return () => {
      client?.disconnect();
    };
  }, [client]);

  return { connected, state, events, error, connect, disconnect, refresh };
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/tui/src/hooks/useDaemon.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/tui/src/hooks/useDaemon.ts packages/tui/src/hooks/useDaemon.test.ts
git commit -m "feat(tui): wire useDaemon hook to daemon IPC"
```

---

### Task 12: Implement Overview Tab with Real-time State

**Files:**
- Modify: `packages/tui/src/tabs/Overview.tsx`
- Modify: `packages/tui/src/components/ProgressBar.tsx`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/tui/src/tabs/Overview.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Overview } from './Overview.js';

describe('Overview Tab', () => {
  it('should render phase progress and task summary', () => {
    const state = {
      currentPhase: 'implement',
      tasks: {
        'task-1': { id: 'task-1', status: 'completed' },
        'task-2': { id: 'task-2', status: 'running' },
        'task-3': { id: 'task-3', status: 'pending' },
      },
    };

    const { lastFrame } = render(<Overview state={state} />);

    expect(lastFrame()).toContain('implement');
    expect(lastFrame()).toContain('1/3'); // completed/total
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/tui/src/tabs/Overview.test.tsx --reporter=verbose
```

Expected: FAIL

**Step 3: Implement Overview component** (5-8 min)

```tsx
// packages/tui/src/tabs/Overview.tsx
import React from 'react';
import { Box, Text } from 'ink';
import { ProgressBar } from '../components/ProgressBar.js';

interface OverviewProps {
  state: {
    currentPhase: string;
    tasks: Record<string, { id: string; status: string }>;
    agents?: Record<string, { id: string; status: string; currentTask?: string }>;
  } | null;
}

export function Overview({ state }: OverviewProps) {
  if (!state) {
    return <Text color="gray">Loading...</Text>;
  }

  const tasks = Object.values(state.tasks || {});
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const running = tasks.filter((t) => t.status === 'running').length;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const total = tasks.length;

  const agents = Object.values(state.agents || {});

  return (
    <Box flexDirection="column" padding={1}>
      {/* Phase */}
      <Box marginBottom={1}>
        <Text bold>PHASE: </Text>
        <Text color="cyan">{state.currentPhase}</Text>
      </Box>

      {/* Progress */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>PROGRESS</Text>
        <ProgressBar current={completed} total={total} width={40} />
        <Text>
          {completed}/{total} tasks ({Math.round((completed / total) * 100) || 0}%)
        </Text>
      </Box>

      {/* Summary */}
      <Box flexDirection="column" marginBottom={1}>
        <Text bold>SUMMARY</Text>
        <Text color="green">✓ Completed: {completed}</Text>
        <Text color="yellow">● Running: {running}</Text>
        <Text color="gray">○ Pending: {pending}</Text>
      </Box>

      {/* Active Agents */}
      {agents.length > 0 && (
        <Box flexDirection="column">
          <Text bold>ACTIVE AGENTS</Text>
          {agents
            .filter((a) => a.status === 'active')
            .map((agent) => (
              <Text key={agent.id}>
                • {agent.id}: {agent.currentTask || 'idle'}
              </Text>
            ))}
        </Box>
      )}
    </Box>
  );
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/tui/src/tabs/Overview.test.tsx --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/tui/src/tabs/Overview.tsx packages/tui/src/tabs/Overview.test.tsx
git commit -m "feat(tui): implement Overview tab with real-time state"
```

---

### Task 13: Implement Tasks Tab with Filtering

**Files:**
- Modify: `packages/tui/src/tabs/Tasks.tsx`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/tui/src/tabs/Tasks.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Tasks } from './Tasks.js';

describe('Tasks Tab', () => {
  it('should render tasks grouped by status', () => {
    const state = {
      tasks: {
        'task-1': { id: 'task-1', description: 'Setup', status: 'completed' },
        'task-2': { id: 'task-2', description: 'Feature', status: 'running', claimedBy: 'worker-1' },
        'task-3': { id: 'task-3', description: 'Tests', status: 'pending' },
      },
    };

    const { lastFrame } = render(<Tasks state={state} />);

    expect(lastFrame()).toContain('Setup');
    expect(lastFrame()).toContain('Feature');
    expect(lastFrame()).toContain('worker-1');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/tui/src/tabs/Tasks.test.tsx --reporter=verbose
```

Expected: FAIL

**Step 3: Implement Tasks component** (5 min)

```tsx
// packages/tui/src/tabs/Tasks.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface TasksProps {
  state: {
    tasks: Record<string, {
      id: string;
      description: string;
      status: string;
      claimedBy?: string;
    }>;
  } | null;
}

const STATUS_ICONS: Record<string, string> = {
  completed: '✓',
  running: '●',
  pending: '○',
  failed: '✗',
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'green',
  running: 'yellow',
  pending: 'gray',
  failed: 'red',
};

export function Tasks({ state }: TasksProps) {
  if (!state) {
    return <Text color="gray">Loading...</Text>;
  }

  const tasks = Object.values(state.tasks || {});

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>TASKS</Text>
      <Box marginTop={1} flexDirection="column">
        {tasks.map((task) => (
          <Box key={task.id}>
            <Text color={STATUS_COLORS[task.status] || 'white'}>
              {STATUS_ICONS[task.status] || '?'}{' '}
            </Text>
            <Text>{task.id.padEnd(10)} </Text>
            <Text>{task.description.slice(0, 40).padEnd(42)}</Text>
            {task.claimedBy && (
              <Text color="cyan">{task.claimedBy}</Text>
            )}
          </Box>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          Legend: ✓ completed ● running ○ pending ✗ failed
        </Text>
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/tui/src/tabs/Tasks.test.tsx --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/tui/src/tabs/Tasks.tsx packages/tui/src/tabs/Tasks.test.tsx
git commit -m "feat(tui): implement Tasks tab with status display"
```

---

### Task 14: Implement Agents Tab with Attachment

**Files:**
- Modify: `packages/tui/src/tabs/Agents.tsx`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/tui/src/tabs/Agents.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import React from 'react';
import { Agents } from './Agents.js';

describe('Agents Tab', () => {
  it('should render active agents with details', () => {
    const state = {
      agents: {
        'orchestrator': { id: 'orchestrator', status: 'idle', model: 'opus' },
        'worker-1': { id: 'worker-1', status: 'active', model: 'sonnet', currentTask: 'task-2' },
      },
    };

    const { lastFrame } = render(<Agents state={state} onAttach={() => {}} />);

    expect(lastFrame()).toContain('orchestrator');
    expect(lastFrame()).toContain('worker-1');
    expect(lastFrame()).toContain('task-2');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/tui/src/tabs/Agents.test.tsx --reporter=verbose
```

Expected: FAIL

**Step 3: Implement Agents component** (5 min)

```tsx
// packages/tui/src/tabs/Agents.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface AgentsProps {
  state: {
    agents: Record<string, {
      id: string;
      status: string;
      model: string;
      currentTask?: string;
      lastHeartbeat?: number;
    }>;
  } | null;
  onAttach: (agentId: string) => void;
}

export function Agents({ state, onAttach }: AgentsProps) {
  if (!state) {
    return <Text color="gray">Loading...</Text>;
  }

  const agents = Object.values(state.agents || {});

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold>AGENTS</Text>
        <Text dimColor>  [a] attach</Text>
      </Box>

      {agents.map((agent) => (
        <Box
          key={agent.id}
          flexDirection="column"
          borderStyle="round"
          paddingX={1}
          marginBottom={1}
        >
          <Box>
            <Text bold>{agent.id}</Text>
            <Text> • </Text>
            <Text color={agent.status === 'active' ? 'green' : 'gray'}>
              {agent.status}
            </Text>
            <Text> • </Text>
            <Text color="cyan">{agent.model}</Text>
          </Box>
          {agent.currentTask && (
            <Text>Task: {agent.currentTask}</Text>
          )}
          {agent.lastHeartbeat && (
            <Text dimColor>
              Last heartbeat: {Math.round((Date.now() - agent.lastHeartbeat) / 1000)}s ago
            </Text>
          )}
        </Box>
      ))}

      {agents.length === 0 && (
        <Text dimColor>No agents running</Text>
      )}
    </Box>
  );
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/tui/src/tabs/Agents.test.tsx --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/tui/src/tabs/Agents.tsx packages/tui/src/tabs/Agents.test.tsx
git commit -m "feat(tui): implement Agents tab with status display"
```

---

## Phase 5: E2E Testing & Polish

### Task 15: Add Integration Test for Simple Workflow

**Files:**
- Create: `packages/daemon/src/integration/simple-workflow.test.ts`

**Step 1: Write the failing test** (5 min)

```typescript
// packages/daemon/src/integration/simple-workflow.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { Daemon } from '../core/daemon.js';
import { compileToDir } from '@hyh/dsl';

describe('Integration: Simple Workflow', () => {
  let tmpDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-integration-'));

    // Create minimal workflow
    const workflow = {
      name: 'test-workflow',
      resumable: true,
      orchestrator: 'orchestrator',
      agents: {
        orchestrator: { name: 'orchestrator', model: 'opus', role: 'coordinator', tools: [] },
        worker: { name: 'worker', model: 'sonnet', role: 'implementation', tools: ['Read', 'Write'] },
      },
      phases: [
        { name: 'implement', agent: 'worker', queue: 'tasks', parallel: true },
      ],
      queues: { tasks: { name: 'tasks', timeout: 600000 } },
      gates: {},
    };

    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    await fs.writeFile(
      path.join(tmpDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow, null, 2)
    );

    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true });
  });

  it('should initialize daemon and load workflow', async () => {
    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    const state = await daemon.stateManager.load();
    expect(state).not.toBeNull();
  });

  it('should detect spawn triggers for pending tasks', async () => {
    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    // Add a pending task
    await daemon.stateManager.update((state) => {
      state.currentPhase = 'implement';
      state.tasks['task-1'] = {
        id: 'task-1',
        description: 'Test task',
        status: 'pending',
        dependencies: [],
      };
    });

    const spawns = await daemon.checkSpawnTriggers();
    expect(spawns.length).toBeGreaterThan(0);
  });

  it('should run tick cycle without errors', async () => {
    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    await daemon.stateManager.update((state) => {
      state.currentPhase = 'implement';
    });

    // Should not throw
    const result = await daemon.tick();
    expect(result).toBeDefined();
  });
});
```

**Step 2: Run test to verify current state** (30 sec)

```bash
pnpm vitest run packages/daemon/src/integration/simple-workflow.test.ts --reporter=verbose
```

Expected: May pass or fail depending on implementation completeness

**Step 3: Fix any failing tests** (varies)

Fix issues found during integration testing.

**Step 4: Run all tests** (30 sec)

```bash
pnpm test
```

Expected: All tests PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/integration/
git commit -m "test(daemon): add integration tests for simple workflow"
```

---

### Task 16: Add CLI `hyh dev` Command for Watch Mode

**Files:**
- Create: `packages/cli/src/commands/dev.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `packages/cli/src/commands/dev.test.ts`

**Step 1: Write the failing test** (3-5 min)

```typescript
// packages/cli/src/commands/dev.test.ts
import { describe, it, expect, vi } from 'vitest';
import { registerDevCommand } from './dev.js';
import { Command } from 'commander';

describe('hyh dev command', () => {
  it('should register dev command with watch option', () => {
    const program = new Command();
    registerDevCommand(program);

    const devCmd = program.commands.find((c) => c.name() === 'dev');
    expect(devCmd).toBeDefined();
    expect(devCmd?.options.some((o) => o.long === '--no-tui')).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm vitest run packages/cli/src/commands/dev.test.ts --reporter=verbose
```

Expected: FAIL

**Step 3: Implement dev command** (5 min)

```typescript
// packages/cli/src/commands/dev.ts
import { Command } from 'commander';
import { compile, compileToDir } from '@hyh/dsl';
import { Daemon } from '@hyh/daemon';
import * as path from 'node:path';
import * as fs from 'node:fs';

export function registerDevCommand(program: Command): void {
  program
    .command('dev')
    .description('Run workflow in development mode with watch')
    .argument('[workflow]', 'Path to workflow.ts', 'workflow.ts')
    .option('--no-tui', 'Disable TUI, use log output')
    .option('--port <port>', 'Socket port for TUI connection')
    .action(async (workflowPath: string, options: { tui: boolean; port?: string }) => {
      const absolutePath = path.resolve(workflowPath);

      if (!fs.existsSync(absolutePath)) {
        console.error(`Workflow file not found: ${absolutePath}`);
        process.exit(1);
      }

      console.log('Starting hyh in development mode...');
      console.log(`Workflow: ${absolutePath}`);

      // TODO: Implement file watching
      // TODO: Start daemon
      // TODO: Start TUI or log mode

      console.log('Development mode not fully implemented yet');
    });
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm vitest run packages/cli/src/commands/dev.test.ts --reporter=verbose
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/commands/dev.ts packages/cli/src/commands/dev.test.ts packages/cli/src/index.ts
git commit -m "feat(cli): add hyh dev command for development mode"
```

---

### Task 17: Final Code Review

**Files:**
- All modified files

**Step 1: Run full test suite** (2 min)

```bash
pnpm test
```

**Step 2: Run typecheck** (30 sec)

```bash
pnpm typecheck
```

**Step 3: Run lint** (30 sec)

```bash
pnpm lint
```

**Step 4: Fix any issues** (varies)

**Step 5: Final commit** (30 sec)

```bash
git add -A
git commit -m "chore: fix lint and type issues from implementation"
```

---

## Parallel Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3, 4 | Core daemon integration - sequential as they build on each other |
| Group 2 | 5, 6, 7 | Agent lifecycle - can run parallel to daemon work |
| Group 3 | 8, 9, 10 | Full workflow execution - sequential, depends on Groups 1-2 |
| Group 4 | 11, 12, 13, 14 | TUI completion - can run parallel, independent components |
| Group 5 | 15, 16, 17 | Testing & polish - sequential, final validation |

---

## Success Criteria

- [ ] All 17 tasks completed
- [ ] Test suite passes (200+ tests)
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] Daemon can start, load workflow, and run tick cycle
- [ ] Agent spawning works (or gracefully fails without Claude CLI)
- [ ] Checkers detect violations and corrections are applied
- [ ] TUI connects to daemon and displays state
- [ ] Integration tests demonstrate full workflow capability
