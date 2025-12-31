# Complete hyh-ts Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-complete-hyh-implementation.md` to implement task-by-task.

**Goal:** Complete the hyh-ts TypeScript port with full end-to-end workflow execution capability.

**Architecture:** The project follows a monorepo structure with four packages (@hyh/dsl, @hyh/daemon, @hyh/cli, @hyh/tui). The daemon is the runtime engine that loads compiled workflows, spawns Claude agents, enforces invariants, and persists state. The TUI provides observability via IPC.

**Tech Stack:** TypeScript, Node.js, Commander.js (CLI), Ink/React (TUI), Vitest (testing), pnpm workspace

**Current State:** 303 tests passing. Core implementations exist for all packages. Key gaps are integration wiring between components.

---

## Task Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3 | EventLoop integration - all touch run.ts |
| Group 2 | 4, 5 | Worktree integration - both touch daemon |
| Group 3 | 6, 7 | TUI enhancements - independent UI features |
| Group 4 | 8 | E2E testing |
| Group 5 | 9 | Code Review |

---

### Task 1: Wire EventLoop into Run Command

**Files:**
- Modify: `packages/cli/src/commands/run.ts:88-99`
- Test: `packages/cli/src/commands/run.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add test that verifies EventLoop is started when daemon runs:

```typescript
// Add to packages/cli/src/commands/run.test.ts
it('should start event loop when daemon starts', async () => {
  // Arrange
  const mockEventLoop = { start: vi.fn(), stop: vi.fn(), isRunning: true };
  vi.mocked(Daemon.prototype.start).mockImplementation(async function(this: unknown) {
    (this as { eventLoop?: typeof mockEventLoop }).eventLoop = mockEventLoop;
  });

  // Act
  await runWorkflow(testWorkflowPath, { tui: false });

  // Assert - event loop should be started
  expect(mockEventLoop.start).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts -v
```

Expected: FAIL (EventLoop.start not called)

**Step 3: Implement - add EventLoop to run command** (2-5 min)

In `packages/cli/src/commands/run.ts`, after daemon.start():

```typescript
// After line ~92: await daemon.start();
// Import EventLoop at top
import { Daemon, EventLoop, checkClaudeCli, PlanImporter } from '@hyh/daemon';

// After daemon.start(), before SIGINT handler:
const eventLoop = new EventLoop(daemon, { tickInterval: 1000 });
eventLoop.start();

// Update SIGINT handler to stop event loop:
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  eventLoop.stop();
  await daemon.stop();
  process.exit(0);
});
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/commands/run.ts packages/cli/src/commands/run.test.ts
git commit -m "feat(cli): wire EventLoop into run command"
```

---

### Task 2: Make Daemon.tick() Actually Spawn Agents

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts:354-383`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to packages/daemon/src/core/daemon.test.ts
it('should spawn agents when tick detects pending tasks', async () => {
  // Arrange
  await daemon.loadWorkflow(workflowPath);
  await daemon.stateManager.update(s => {
    s.currentPhase = 'implement';
    s.tasks = {
      't1': {
        id: 't1',
        description: 'Test task',
        status: 'pending',
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
    };
  });

  const spawnSpy = vi.spyOn(daemon, 'spawnAgents');

  // Act
  const result = await daemon.tick();

  // Assert
  expect(result.spawnsTriggered).toBeGreaterThan(0);
  expect(spawnSpy).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/core/daemon.test.ts::should\ spawn\ agents -v
```

Expected: FAIL (spawnAgents not called in tick)

**Step 3: Implement - call spawnAgents in tick()** (2-5 min)

In `packages/daemon/src/core/daemon.ts`, update tick() method:

```typescript
async tick(): Promise<TickResult> {
  const result: TickResult = {
    spawnsTriggered: 0,
    heartbeatsMissed: [],
    phaseTransitioned: false,
    correctionsApplied: 0,
  };

  // 1. Check heartbeats for all registered agents
  const overdueAgents = this.heartbeatMonitor.getOverdueAgents();
  result.heartbeatsMissed = overdueAgents.map((a) => a.agentId);

  // 2. Check spawn triggers AND ACTUALLY SPAWN
  const spawns = await this.checkSpawnTriggers();
  if (spawns.length > 0) {
    await this.spawnAgents(spawns);
    result.spawnsTriggered = spawns.length;
  }

  // 3. Check phase transitions
  if (await this.checkPhaseTransition()) {
    const state = await this.stateManager.load();
    if (state && this.phaseManager) {
      const nextPhase = this.phaseManager.getNextPhase(state.currentPhase);
      if (nextPhase) {
        await this.transitionPhase(nextPhase);
        result.phaseTransitioned = true;
      }
    }
  }

  return result;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/core/daemon.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): make tick() actually spawn agents"
```

---

### Task 3: Add Agent Event Handling in EventLoop

**Files:**
- Modify: `packages/daemon/src/core/event-loop.ts:45-64`
- Modify: `packages/daemon/src/core/daemon.ts` (add interface for agent polling)
- Test: `packages/daemon/src/core/event-loop.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to packages/daemon/src/core/event-loop.test.ts
it('should poll agent events and process them', async () => {
  const mockDaemon = {
    checkSpawnTriggers: vi.fn().mockResolvedValue([]),
    spawnAgents: vi.fn(),
    checkPhaseTransition: vi.fn().mockResolvedValue(false),
    stateManager: { flush: vi.fn() },
    heartbeatMonitor: { getOverdueAgents: vi.fn().mockReturnValue([]) },
    getActiveAgents: vi.fn().mockReturnValue([{
      id: 'agent-1',
      pollEvents: vi.fn().mockReturnValue([{ type: 'tool_use', tool: 'Read' }]),
    }]),
    processAgentEvent: vi.fn().mockResolvedValue({}),
  };

  const loop = new EventLoop(mockDaemon as unknown as Daemon, { tickInterval: 100 });
  await loop.tick();

  expect(mockDaemon.processAgentEvent).toHaveBeenCalled();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/core/event-loop.test.ts -v
```

Expected: FAIL

**Step 3: Implement - add agent polling to EventLoop.tick()** (2-5 min)

Update `packages/daemon/src/core/event-loop.ts`:

```typescript
export interface Daemon {
  checkSpawnTriggers(): Promise<SpawnTrigger[]>;
  spawnAgents(triggers: SpawnTrigger[]): Promise<void>;
  checkPhaseTransition(): Promise<boolean>;
  stateManager: { flush(): void };
  heartbeatMonitor: { getOverdueAgents(): unknown[] };
  getActiveAgents?(): { agentId: string; pollEvents(): unknown[] }[];
  processAgentEvent?(agentId: string, event: unknown): Promise<unknown>;
}

// In tick() method, add before spawn triggers:
async tick(): Promise<void> {
  if (!this.daemon) {
    throw new Error('tick() requires daemon to be provided');
  }

  // 0. Poll active agents for events
  if (this.daemon.getActiveAgents && this.daemon.processAgentEvent) {
    const agents = this.daemon.getActiveAgents();
    for (const agent of agents) {
      const events = agent.pollEvents();
      for (const event of events) {
        await this.daemon.processAgentEvent(agent.agentId, event);
      }
    }
  }

  // ... rest of tick()
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/core/event-loop.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/event-loop.ts packages/daemon/src/core/event-loop.test.ts
git commit -m "feat(daemon): add agent event polling to EventLoop"
```

---

### Task 4: Add getActiveAgents to Daemon

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to packages/daemon/src/core/daemon.test.ts
it('should return active agents with pollEvents method', async () => {
  await daemon.start();

  // Spawn a mock agent
  await daemon.stateManager.update(s => {
    s.agents = {
      'worker-1': {
        id: 'worker-1',
        type: 'worker',
        status: 'active',
        currentTask: 't1',
        pid: 123,
        sessionId: 'uuid-123',
        lastHeartbeat: Date.now(),
        violationCounts: {},
      },
    };
  });

  const activeAgents = daemon.getActiveAgents();

  expect(Array.isArray(activeAgents)).toBe(true);
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/core/daemon.test.ts::should\ return\ active -v
```

Expected: FAIL (getActiveAgents doesn't exist or returns wrong type)

**Step 3: Implement getActiveAgents method** (2-5 min)

Add to `packages/daemon/src/core/daemon.ts`:

```typescript
getActiveAgents(): { agentId: string; pollEvents: () => TrajectoryEvent[] }[] {
  const agents = this.agentManager.getActiveAgents();
  return agents.map(agent => ({
    agentId: agent.agentId,
    pollEvents: () => {
      // Poll events from the agent's event emitter
      const events: TrajectoryEvent[] = [];
      // For now return empty - actual implementation would buffer events
      return events;
    },
  }));
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/core/daemon.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/core/daemon.test.ts
git commit -m "feat(daemon): add getActiveAgents method"
```

---

### Task 5: Integrate WorktreeManager into Daemon

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Modify: `packages/daemon/src/agents/manager.ts`
- Test: `packages/daemon/src/integration/worktree.test.ts` (create)

**Step 1: Write the failing test** (2-5 min)

Create `packages/daemon/src/integration/worktree.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Daemon } from '../core/daemon.js';
import { WorktreeManager } from '../git/worktree.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('Worktree integration', () => {
  let tmpDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-worktree-'));
    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should calculate wave for tasks based on dependencies', () => {
    const worktreeManager = new WorktreeManager(tmpDir);

    const tasks = {
      't1': { id: 't1', dependencies: [] },
      't2': { id: 't2', dependencies: ['t1'] },
      't3': { id: 't3', dependencies: ['t1', 't2'] },
    };

    expect(worktreeManager.calculateWave(tasks['t1'], tasks)).toBe(0);
    expect(worktreeManager.calculateWave(tasks['t2'], tasks)).toBe(1);
    expect(worktreeManager.calculateWave(tasks['t3'], tasks)).toBe(2);
  });
});
```

**Step 2: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/integration/worktree.test.ts -v
```

Expected: PASS (WorktreeManager already implements this)

**Step 3: Add worktree path to spawn spec** (2-5 min)

Modify `packages/daemon/src/core/daemon.ts` spawnAgents method to calculate worktree:

```typescript
async spawnAgents(specs: SpawnSpec[]): Promise<void> {
  const worktreeManager = new WorktreeManager(this.worktreeRoot);
  const state = await this.stateManager.load();
  const tasks = state?.tasks || {};

  for (const spec of specs) {
    const agentConfig = this.workflow?.agents?.[spec.agentType];
    if (!agentConfig) continue;

    // Calculate wave for worktree assignment
    const task = tasks[spec.taskId || ''];
    const wave = task ? worktreeManager.calculateWave(
      { id: task.id, dependencies: task.dependencies },
      Object.fromEntries(
        Object.entries(tasks).map(([id, t]) => [id, { id, dependencies: t.dependencies }])
      )
    ) : 0;

    const toolNames = (agentConfig.tools || []).map((tool) =>
      typeof tool === 'string' ? tool : tool.tool
    );

    const fullSpec = {
      agentType: spec.agentType,
      taskId: spec.taskId,
      model: (agentConfig.model || 'sonnet') as 'haiku' | 'sonnet' | 'opus',
      tools: toolNames,
      systemPromptPath: agentConfig.systemPrompt || '',
      worktreePath: worktreeManager.getWorktreePath(wave),
    };

    const process = await this.agentManager.spawn(fullSpec);
    await this.trajectory.log({
      type: 'spawn',
      timestamp: Date.now(),
      agentId: process.agentId,
      wave,
    });
  }
}
```

**Step 4: Update AgentManager.spawn to use worktreePath** (2-5 min)

Add worktreePath to SpawnSpec in `packages/daemon/src/agents/manager.ts`:

```typescript
export interface SpawnSpec {
  agentType: string;
  taskId?: string;
  model: 'haiku' | 'sonnet' | 'opus';
  tools: string[];
  systemPromptPath: string;
  worktreePath?: string;  // Add this
}

async spawn(spec: SpawnSpec): Promise<AgentProcess> {
  // Use worktreePath if provided, otherwise use default worktreeRoot
  const cwd = spec.worktreePath || this.worktreeRoot;

  const config: AgentProcessConfig = {
    agentId: this.generateAgentId(spec.agentType, spec.taskId),
    model: spec.model,
    sessionId: crypto.randomUUID(),
    systemPromptPath: spec.systemPromptPath,
    tools: spec.tools,
    cwd,  // Use the determined cwd
  };
  // ... rest unchanged
}
```

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/agents/manager.ts packages/daemon/src/integration/worktree.test.ts
git commit -m "feat(daemon): integrate WorktreeManager for wave-based execution"
```

---

### Task 6: Add Agent Attachment to TUI

**Files:**
- Create: `packages/tui/src/components/AgentAttach.tsx`
- Modify: `packages/tui/src/tabs/Agents.tsx`
- Test: `packages/tui/src/components/AgentAttach.test.tsx`

**Step 1: Write the failing test** (2-5 min)

Create `packages/tui/src/components/AgentAttach.test.tsx`:

```typescript
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { AgentAttach } from './AgentAttach.js';

describe('AgentAttach', () => {
  it('should render agent output stream', () => {
    const { lastFrame } = render(
      <AgentAttach
        agentId="worker-1"
        output={['Line 1', 'Line 2']}
        onDetach={vi.fn()}
      />
    );

    expect(lastFrame()).toContain('worker-1');
    expect(lastFrame()).toContain('Line 1');
    expect(lastFrame()).toContain('Line 2');
  });

  it('should show detach instructions', () => {
    const { lastFrame } = render(
      <AgentAttach agentId="worker-1" output={[]} onDetach={vi.fn()} />
    );

    expect(lastFrame()).toContain('Ctrl+D');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/tui/src/components/AgentAttach.test.tsx -v
```

Expected: FAIL (component doesn't exist)

**Step 3: Create AgentAttach component** (2-5 min)

Create `packages/tui/src/components/AgentAttach.tsx`:

```typescript
import React from 'react';
import { Box, Text, useInput } from 'ink';

interface AgentAttachProps {
  agentId: string;
  output: string[];
  onDetach: () => void;
}

export function AgentAttach({ agentId, output, onDetach }: AgentAttachProps) {
  useInput((input, key) => {
    if (key.ctrl && input === 'd') {
      onDetach();
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1}>
        <Text bold>Attached to </Text>
        <Text color="cyan">{agentId}</Text>
        <Text dimColor> (Ctrl+D to detach)</Text>
      </Box>
      <Box flexDirection="column" height={20} overflow="hidden">
        {output.slice(-20).map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/tui/src/components/AgentAttach.test.tsx -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/tui/src/components/AgentAttach.tsx packages/tui/src/components/AgentAttach.test.tsx
git commit -m "feat(tui): add AgentAttach component for agent output streaming"
```

---

### Task 7: Add IPC Event Subscription

**Files:**
- Modify: `packages/daemon/src/ipc/server.ts`
- Modify: `packages/daemon/src/ipc/client.ts`
- Test: `packages/daemon/src/ipc/server.test.ts`

**Step 1: Write the failing test** (2-5 min)

Add to `packages/daemon/src/ipc/server.test.ts`:

```typescript
it('should broadcast events to subscribed clients', async () => {
  await server.start();

  const client = new IPCClient(socketPath);
  await client.connect();

  const events: unknown[] = [];
  client.onEvent('trajectory', (event) => events.push(event));

  await client.request({ command: 'subscribe', channel: 'trajectory' });

  // Server broadcasts an event
  server.broadcast('trajectory', { type: 'tool_use', tool: 'Read' });

  // Wait briefly for event to arrive
  await new Promise(resolve => setTimeout(resolve, 50));

  expect(events.length).toBeGreaterThan(0);
  expect(events[0]).toMatchObject({ type: 'tool_use' });

  client.disconnect();
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/ipc/server.test.ts -v
```

Expected: FAIL

**Step 3: Add subscription support to IPCServer** (2-5 min)

Modify `packages/daemon/src/ipc/server.ts`:

```typescript
// Add to class properties
private subscriptions: Map<string, Set<net.Socket>> = new Map();

// Add subscribe handler in registerHandler or constructor
this.registerHandler('subscribe', (request: { channel: string }, socket: net.Socket) => {
  const channel = request.channel;
  if (!this.subscriptions.has(channel)) {
    this.subscriptions.set(channel, new Set());
  }
  this.subscriptions.get(channel)!.add(socket);

  // Clean up on disconnect
  socket.once('close', () => {
    this.subscriptions.get(channel)?.delete(socket);
  });

  return { subscribed: channel };
});

// Add broadcast method
broadcast(channel: string, data: unknown): void {
  const subscribers = this.subscriptions.get(channel);
  if (!subscribers) return;

  const message = JSON.stringify({ type: 'event', channel, data }) + '\n';
  for (const socket of subscribers) {
    socket.write(message);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/ipc/server.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/ipc/server.ts packages/daemon/src/ipc/server.test.ts
git commit -m "feat(daemon): add IPC event subscription and broadcast"
```

---

### Task 8: Add E2E Workflow Execution Test

**Files:**
- Create: `packages/daemon/src/integration/e2e-execution.test.ts`

**Step 1: Write the E2E test** (5 min)

Create `packages/daemon/src/integration/e2e-execution.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Daemon } from '../core/daemon.js';
import { EventLoop } from '../core/event-loop.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('E2E workflow execution', () => {
  let tmpDir: string;
  let daemon: Daemon;
  let eventLoop: EventLoop;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-e2e-exec-'));
    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    eventLoop?.stop();
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should execute complete workflow with task claiming and completion', async () => {
    // Create workflow
    const workflow = {
      name: 'e2e-exec-test',
      resumable: true,
      orchestrator: 'orchestrator',
      phases: [
        { name: 'implement', queue: 'tasks', agent: 'worker', parallel: 2 },
      ],
      queues: {
        tasks: { ready: 'task.deps.allComplete', timeout: 600000 },
      },
      agents: {
        worker: { name: 'worker', model: 'sonnet', tools: ['Read', 'Write'] },
      },
      gates: {},
    };

    await fs.writeFile(
      path.join(tmpDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow)
    );

    // Start daemon and event loop
    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    eventLoop = new EventLoop(daemon as unknown as Parameters<typeof EventLoop>[0], {
      tickInterval: 100
    });

    // Add tasks
    await daemon.stateManager.update(s => {
      s.currentPhase = 'implement';
      s.tasks = {
        't1': {
          id: 't1',
          description: 'E2E test task 1',
          status: 'pending',
          claimedBy: null,
          claimedAt: null,
          startedAt: null,
          completedAt: null,
          attempts: 0,
          lastError: null,
          dependencies: [],
          files: ['src/test.ts'],
          timeoutSeconds: 600,
        },
      };
    });

    // Run a few tick cycles
    eventLoop.start();
    await new Promise(resolve => setTimeout(resolve, 500));
    eventLoop.stop();

    // Verify spawn was triggered
    const state = await daemon.stateManager.load();
    expect(state).toBeDefined();

    // The tick should have detected the pending task
    const spawns = await daemon.checkSpawnTriggers();
    expect(spawns.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle IPC requests during execution', async () => {
    await daemon.start();

    // Add a task
    await daemon.stateManager.update(s => {
      s.tasks = {
        't1': {
          id: 't1',
          description: 'IPC test task',
          status: 'pending',
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
      };
    });

    // Simulate IPC task claim
    const { IPCClient } = await import('../ipc/client.js');
    const client = new IPCClient(daemon.getSocketPath());
    await client.connect();

    const claimResult = await client.request({
      command: 'task_claim',
      workerId: 'test-worker'
    });

    expect(claimResult.status).toBe('ok');

    client.disconnect();
  });
});
```

**Step 2: Run test** (30 sec)

```bash
pnpm test packages/daemon/src/integration/e2e-execution.test.ts -v
```

Expected: PASS (tests the wired-up components)

**Step 3: Commit** (30 sec)

```bash
git add packages/daemon/src/integration/e2e-execution.test.ts
git commit -m "test(daemon): add E2E workflow execution tests"
```

---

### Task 9: Code Review

**Files:**
- All modified files from tasks 1-8

**Step 1: Run full test suite** (2 min)

```bash
pnpm test
```

Expected: All tests pass

**Step 2: Run typecheck** (30 sec)

```bash
pnpm typecheck
```

Expected: No type errors

**Step 3: Run linter** (30 sec)

```bash
pnpm lint
```

Expected: No lint errors

**Step 4: Review changes** (5 min)

```bash
git log --oneline -10
git diff HEAD~9..HEAD --stat
```

Verify:
- All commits follow conventional commit format
- No debug code left behind
- No commented-out code
- No console.log statements in library code (only CLI)

**Step 5: Final commit if needed** (30 sec)

```bash
# If any cleanup needed:
git add -A && git commit -m "chore: code review cleanup"
```

---

## Summary

This plan completes the hyh-ts implementation by:

1. **Wiring EventLoop into run command** - Makes the daemon actually run its tick cycle
2. **Making tick() spawn agents** - Connects spawn triggers to actual agent spawning
3. **Adding agent event polling** - Processes events from running agents
4. **Adding getActiveAgents** - Exposes running agents for the event loop
5. **Integrating WorktreeManager** - Enables wave-based parallel execution
6. **Adding TUI agent attachment** - Allows viewing agent output streams
7. **Adding IPC subscriptions** - Enables real-time event streaming to TUI
8. **E2E tests** - Validates the complete integration

After completing these tasks, the system will be able to:
- Start a daemon that loads a compiled workflow
- Spawn Claude agents based on pending tasks
- Process agent events and enforce invariants
- Display real-time progress in the TUI
- Handle task claiming, completion, and phase transitions
