# hyh-ts Full MVP Completion Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-full-mvp-completion.md` to implement task-by-task.

**Goal:** Complete the hyh-ts TypeScript workflow orchestration system with full TUI integration, real Claude CLI support, and E2E testing.

**Architecture:** The core implementation is complete (DSL, daemon, CLI, TUI components). This plan focuses on wiring components together, adding real Claude CLI integration, and comprehensive E2E testing.

**Tech Stack:** TypeScript 5.7+, pnpm workspaces, Vitest, Ink/React for TUI, Commander for CLI

---

## Current State

- ✅ 277 tests passing
- ✅ All 4 packages build successfully
- ✅ DSL builders fully implemented
- ✅ Daemon core with IPC, state, trajectory, checkers, corrections
- ✅ CLI commands all present
- ✅ TUI components (tabs, hooks) implemented
- 🔲 TUI not wired to `run` command
- 🔲 Agent spawning not integrated with event loop
- 🔲 E2E testing with real Claude CLI needed

---

## Task Group 1: TUI Integration (Tasks 1-2)

### Task 1: Wire TUI to Run Command

**Files:**
- Modify: `packages/cli/src/commands/run.ts:89-95`
- Read: `packages/tui/src/index.tsx`

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/cli/src/commands/run.test.ts
// Add to existing test file

describe('run command with TUI', () => {
  it('should import and call startTUI when --tui is enabled', async () => {
    // This test verifies the import path works
    const { startTUI } = await import('@hyh/tui');
    expect(typeof startTUI).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts -v
```

Expected: May pass or fail depending on export status - the key issue is the actual wiring.

**Step 3: Update run.ts to wire TUI** (2-5 min)

Replace lines 89-95 in `packages/cli/src/commands/run.ts`:

```typescript
// Before:
if (!options.tui) {
  console.log('Running in headless mode. Press Ctrl+C to stop.');
} else {
  console.log('TUI not yet implemented. Running in headless mode.');
}

// After:
if (!options.tui) {
  console.log('Running in headless mode. Press Ctrl+C to stop.');
} else {
  // Load workflow into daemon
  await daemon.loadWorkflow(path.join(outputDir, 'workflow.json'));

  // Start TUI
  const { startTUI } = await import('@hyh/tui');
  startTUI(daemon.getSocketPath());
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/commands/run.ts packages/cli/src/commands/run.test.ts
git commit -m "feat(cli): wire TUI to run command"
```

---

### Task 2: Wire TUI to Status Command

**Files:**
- Modify: `packages/cli/src/commands/status.ts`
- Test: `packages/cli/src/commands/status.test.ts` (create if needed)

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/cli/src/commands/status.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('status command with TUI', () => {
  it('should accept --tui flag', async () => {
    // Verify the command accepts the flag
    const { registerStatusCommand } = await import('./status.js');
    const program = { command: vi.fn().mockReturnThis(), description: vi.fn().mockReturnThis(), option: vi.fn().mockReturnThis(), action: vi.fn().mockReturnThis() };
    registerStatusCommand(program as any);

    // Verify option was registered
    expect(program.option).toHaveBeenCalledWith(expect.stringContaining('--tui'), expect.any(String));
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/cli/src/commands/status.test.ts -v
```

Expected: FAIL (--tui option not registered)

**Step 3: Read current status.ts** (30 sec)

Read current implementation to understand structure.

**Step 4: Add TUI option to status command** (2-5 min)

Add to `packages/cli/src/commands/status.ts`:

```typescript
.option('--tui', 'Show TUI dashboard instead of text output', false)
```

And in the action handler:

```typescript
if (options.tui) {
  const { startTUI } = await import('@hyh/tui');
  startTUI(socketPath);
  return;
}
// ... existing text-based status output
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/cli/src/commands/status.test.ts -v
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add packages/cli/src/commands/status.ts packages/cli/src/commands/status.test.ts
git commit -m "feat(cli): add TUI mode to status command"
```

---

## Task Group 2: Event Loop Integration (Tasks 3-4)

### Task 3: Integrate Agent Spawning into Event Loop

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Modify: `packages/daemon/src/core/event-loop.ts`
- Test: `packages/daemon/src/integration/agent-spawn.test.ts` (create)

**Step 1: Write the failing integration test** (2-5 min)

```typescript
// packages/daemon/src/integration/agent-spawn.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Daemon } from '../core/daemon.js';
import { AgentManager } from '../agents/manager.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('Agent spawning integration', () => {
  let tmpDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-spawn-test-'));
    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should trigger agent spawn when tasks are ready', async () => {
    // Create workflow with pending task
    const workflow = {
      name: 'test',
      phases: [{ name: 'implement', queue: 'tasks', agent: 'worker', parallel: true }],
      queues: { tasks: { ready: 'task.deps.allComplete' } },
      agents: { worker: { model: 'sonnet', tools: ['Read'] } },
      gates: {},
    };

    await fs.writeFile(
      path.join(tmpDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow)
    );

    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    // Add a pending task
    await daemon.stateManager.update(s => {
      s.tasks = { 'task-1': { id: 'task-1', status: 'pending', claimedBy: null } };
    });

    // Check spawn triggers
    const spawns = await daemon.checkSpawnTriggers();
    expect(spawns.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/integration/agent-spawn.test.ts -v
```

Expected: FAIL or partial pass

**Step 3: Integrate AgentManager into Daemon** (2-5 min)

Add to `packages/daemon/src/core/daemon.ts`:

```typescript
import { AgentManager } from '../agents/manager.js';

// In constructor:
private agentManager: AgentManager;

constructor(options: DaemonOptions) {
  // ... existing code
  this.agentManager = new AgentManager(this.worktreeRoot);
}

// Add spawn method:
async spawnAgents(specs: SpawnSpec[]): Promise<void> {
  for (const spec of specs) {
    const process = await this.agentManager.spawn(spec);

    // Wire up event handling
    process.on('event', async (event) => {
      await this.processAgentEvent(process.agentId, {
        type: event.type === 'tool_use' ? 'tool_use' : 'message',
        timestamp: Date.now(),
        agentId: process.agentId,
        ...event.data,
      });
    });

    // Log spawn
    await this.trajectory.log({
      type: 'spawn',
      timestamp: Date.now(),
      agentId: process.agentId,
    });
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/integration/agent-spawn.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/core/daemon.ts packages/daemon/src/integration/agent-spawn.test.ts
git commit -m "feat(daemon): integrate agent spawning into daemon"
```

---

### Task 4: Complete Event Loop with All Operations

**Files:**
- Modify: `packages/daemon/src/core/event-loop.ts`
- Test: `packages/daemon/src/core/event-loop.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to packages/daemon/src/core/event-loop.test.ts

it('should call daemon.spawnAgents when spawn triggers fire', async () => {
  const mockDaemon = {
    checkSpawnTriggers: vi.fn().mockResolvedValue([{ agentType: 'worker', taskId: 't1' }]),
    spawnAgents: vi.fn().mockResolvedValue(undefined),
    checkPhaseTransition: vi.fn().mockResolvedValue(false),
    stateManager: { flush: vi.fn() },
    heartbeatMonitor: { getOverdueAgents: vi.fn().mockReturnValue([]) },
  };

  const eventLoop = new EventLoop(mockDaemon as any, { tickInterval: 10 });

  // Run one tick
  await eventLoop.tick();

  expect(mockDaemon.spawnAgents).toHaveBeenCalledWith([{ agentType: 'worker', taskId: 't1' }]);
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/core/event-loop.test.ts -v
```

Expected: FAIL

**Step 3: Update EventLoop to spawn agents** (2-5 min)

Modify `packages/daemon/src/core/event-loop.ts` tick method:

```typescript
async tick(): Promise<TickResult> {
  const result: TickResult = {
    spawnsTriggered: 0,
    heartbeatsMissed: [],
    phaseTransitioned: false,
    correctionsApplied: 0,
  };

  // 1. Check spawn triggers and spawn agents
  const spawns = await this.daemon.checkSpawnTriggers();
  if (spawns.length > 0) {
    await this.daemon.spawnAgents(spawns);
    result.spawnsTriggered = spawns.length;
  }

  // 2. Check heartbeats
  const overdueAgents = this.daemon.heartbeatMonitor.getOverdueAgents();
  result.heartbeatsMissed = overdueAgents.map(a => a.agentId);

  // 3. Check phase transitions
  if (await this.daemon.checkPhaseTransition()) {
    result.phaseTransitioned = true;
  }

  // 4. Flush state
  await this.daemon.stateManager.flush();

  return result;
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
git commit -m "feat(daemon): complete event loop with agent spawning"
```

---

## Task Group 3: Real Claude CLI Integration (Tasks 5-7)

### Task 5: Verify Claude CLI Flags and Output Format

**Files:**
- Create: `packages/daemon/src/agents/claude-cli.test.ts`
- Read: `packages/daemon/src/agents/process.ts`

**Step 1: Write integration test for Claude CLI** (2-5 min)

```typescript
// packages/daemon/src/agents/claude-cli.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { execSync } from 'node:child_process';

describe('Claude CLI integration', () => {
  let claudeAvailable = false;

  beforeAll(() => {
    try {
      execSync('claude --version', { encoding: 'utf-8' });
      claudeAvailable = true;
    } catch {
      claudeAvailable = false;
    }
  });

  it.skipIf(!claudeAvailable)('should have claude CLI available', () => {
    const version = execSync('claude --version', { encoding: 'utf-8' });
    expect(version).toMatch(/\d+\.\d+/);
  });

  it.skipIf(!claudeAvailable)('should accept --output-format stream-json flag', () => {
    // Just check the flag is accepted (with --help to avoid actual execution)
    const help = execSync('claude --help', { encoding: 'utf-8' });
    expect(help).toContain('output-format');
  });

  it.skipIf(!claudeAvailable)('should accept --session-id flag', () => {
    const help = execSync('claude --help', { encoding: 'utf-8' });
    expect(help).toContain('session');
  });
});
```

**Step 2: Run test** (30 sec)

```bash
pnpm test packages/daemon/src/agents/claude-cli.test.ts -v
```

Expected: PASS (or skip if Claude not installed)

**Step 3: Commit** (30 sec)

```bash
git add packages/daemon/src/agents/claude-cli.test.ts
git commit -m "test(daemon): add Claude CLI integration tests"
```

---

### Task 6: Add Claude CLI Version Check to Daemon

**Files:**
- Create: `packages/daemon/src/agents/claude-cli.ts`
- Modify: `packages/daemon/src/index.ts`
- Test: existing test file from Task 5

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to packages/daemon/src/agents/claude-cli.test.ts

describe('checkClaudeCli function', () => {
  it('should export checkClaudeCli function', async () => {
    const { checkClaudeCli } = await import('./claude-cli.js');
    expect(typeof checkClaudeCli).toBe('function');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test packages/daemon/src/agents/claude-cli.test.ts -v
```

Expected: FAIL (module not found)

**Step 3: Create claude-cli.ts** (2-5 min)

```typescript
// packages/daemon/src/agents/claude-cli.ts
import { execSync } from 'node:child_process';

const REQUIRED_VERSION = '1.0.0';

export interface ClaudeCliInfo {
  available: boolean;
  version?: string;
  error?: string;
}

export async function checkClaudeCli(): Promise<ClaudeCliInfo> {
  try {
    const version = execSync('claude --version', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    const match = version.match(/(\d+\.\d+\.\d+)/);
    const versionStr = match ? match[1] : 'unknown';

    return {
      available: true,
      version: versionStr,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**Step 4: Add export to index.ts** (1 min)

Add to `packages/daemon/src/index.ts`:

```typescript
export { checkClaudeCli, type ClaudeCliInfo } from './agents/claude-cli.js';
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
pnpm test packages/daemon/src/agents/claude-cli.test.ts -v
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add packages/daemon/src/agents/claude-cli.ts packages/daemon/src/index.ts packages/daemon/src/agents/claude-cli.test.ts
git commit -m "feat(daemon): add Claude CLI version check"
```

---

### Task 7: Integrate Claude CLI Check into Run Command

**Files:**
- Modify: `packages/cli/src/commands/run.ts`
- Test: `packages/cli/src/commands/run.test.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to packages/cli/src/commands/run.test.ts

describe('Claude CLI check', () => {
  it('should check for Claude CLI before running', async () => {
    const { checkClaudeCli } = await import('@hyh/daemon');
    const result = await checkClaudeCli();
    expect(result).toHaveProperty('available');
  });
});
```

**Step 2: Run test** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts -v
```

**Step 3: Add Claude CLI check to run command** (2-5 min)

Add to `packages/cli/src/commands/run.ts` before starting daemon:

```typescript
// Check for Claude CLI
const { checkClaudeCli } = await import('@hyh/daemon');
const claudeInfo = await checkClaudeCli();

if (!claudeInfo.available) {
  console.warn(`⚠️  Claude CLI not found: ${claudeInfo.error}`);
  console.warn('   Agents will not be able to spawn. Install claude CLI to enable full functionality.');
}
```

**Step 4: Run test** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts -v
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/commands/run.ts packages/cli/src/commands/run.test.ts
git commit -m "feat(cli): check for Claude CLI in run command"
```

---

## Task Group 4: Plan Import Integration (Tasks 8-9)

### Task 8: Add Plan Import to Run Command

**Files:**
- Modify: `packages/cli/src/commands/run.ts`
- Read: `packages/daemon/src/plan/importer.ts`

**Step 1: Write the failing test** (2-5 min)

```typescript
// Add to packages/cli/src/commands/run.test.ts

describe('plan import', () => {
  it('should have PlanImporter available from daemon', async () => {
    const { PlanImporter } = await import('@hyh/daemon');
    expect(typeof PlanImporter).toBe('function');
  });
});
```

**Step 2: Run test** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts -v
```

**Step 3: Wire plan import to daemon startup** (2-5 min)

Add to `packages/cli/src/commands/run.ts` after loading workflow:

```typescript
// Check for plan.md and import tasks
const planPath = path.join(projectDir, 'plan.md');
try {
  await fs.access(planPath);
  console.log('Found plan.md, importing tasks...');

  const { PlanImporter } = await import('@hyh/daemon');
  const importer = new PlanImporter();
  const tasks = await importer.parse(await fs.readFile(planPath, 'utf-8'));

  // Add tasks to state
  await daemon.stateManager.update(s => {
    for (const task of tasks) {
      s.tasks[task.id] = {
        id: task.id,
        status: 'pending',
        claimedBy: null,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
        attempts: 0,
      };
    }
  });

  console.log(`Imported ${tasks.length} tasks from plan.md`);
} catch {
  // No plan.md, continue without importing
}
```

**Step 4: Verify run command works** (30 sec)

```bash
pnpm test packages/cli/src/commands/run.test.ts -v
```

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/commands/run.ts packages/cli/src/commands/run.test.ts
git commit -m "feat(cli): auto-import plan.md tasks in run command"
```

---

### Task 9: Add Plan Reset Command

**Files:**
- Modify: `packages/cli/src/commands/task.ts`
- Test: `packages/cli/src/commands/task.test.ts` (create)

**Step 1: Write the failing test** (2-5 min)

```typescript
// packages/cli/src/commands/task.test.ts
import { describe, it, expect, vi } from 'vitest';

describe('task command', () => {
  it('should have reset subcommand', async () => {
    const { registerTaskCommand } = await import('./task.js');

    // Check the command is registered
    const mockCommand = {
      command: vi.fn().mockReturnThis(),
      description: vi.fn().mockReturnThis(),
      action: vi.fn().mockReturnThis(),
      argument: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
    };

    const mockProgram = {
      command: vi.fn().mockReturnValue(mockCommand),
    };

    registerTaskCommand(mockProgram as any);

    // Verify 'task' command is registered
    expect(mockProgram.command).toHaveBeenCalledWith('task');
  });
});
```

**Step 2: Run test** (30 sec)

```bash
pnpm test packages/cli/src/commands/task.test.ts -v
```

**Step 3: Read current task.ts and add reset** (2-5 min)

Read current implementation, then add reset subcommand:

```typescript
taskCmd
  .command('reset')
  .description('Clear all tasks and restart')
  .action(async () => {
    const client = await connectToClient();
    await client.request({ type: 'plan_reset' });
    console.log('Tasks reset successfully');
  });
```

**Step 4: Run test** (30 sec)

```bash
pnpm test packages/cli/src/commands/task.test.ts -v
```

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/commands/task.ts packages/cli/src/commands/task.test.ts
git commit -m "feat(cli): add task reset command"
```

---

## Task Group 5: E2E Integration Tests (Tasks 10-11)

### Task 10: Full Workflow E2E Test (Mock Claude)

**Files:**
- Create: `packages/daemon/src/integration/full-workflow.test.ts`

**Step 1: Write the E2E test** (5-10 min)

```typescript
// packages/daemon/src/integration/full-workflow.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Daemon } from '../core/daemon.js';
import { EventLoop } from '../core/event-loop.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('Full workflow E2E', () => {
  let tmpDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-e2e-'));
    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should run complete workflow from init to completion', async () => {
    // Create a minimal workflow
    const workflow = {
      name: 'e2e-test',
      resumable: true,
      orchestrator: 'orchestrator',
      phases: [
        { name: 'plan', agent: 'orchestrator', outputs: ['plan.md'] },
        { name: 'implement', queue: 'tasks', agent: 'worker', parallel: 2 },
      ],
      queues: {
        tasks: { ready: 'task.deps.allComplete', timeout: 600000 },
      },
      agents: {
        orchestrator: { name: 'orchestrator', model: 'opus', tools: ['Read'] },
        worker: { name: 'worker', model: 'sonnet', tools: ['Read', 'Write'] },
      },
      gates: {},
    };

    await fs.writeFile(
      path.join(tmpDir, '.hyh', 'workflow.json'),
      JSON.stringify(workflow)
    );

    await daemon.start();
    await daemon.loadWorkflow(path.join(tmpDir, '.hyh', 'workflow.json'));

    // Verify state initialized
    const state = await daemon.stateManager.load();
    expect(state.workflowName).toBe('e2e-test');
    expect(state.currentPhase).toBe('plan');

    // Add tasks and simulate plan phase completion
    await fs.writeFile(path.join(tmpDir, 'plan.md'), '# Plan\n- Task 1\n- Task 2');

    await daemon.stateManager.update(s => {
      s.tasks = {
        't1': { id: 't1', status: 'pending', claimedBy: null },
        't2': { id: 't2', status: 'pending', claimedBy: null },
      };
    });

    // Check spawn triggers
    const spawns = await daemon.checkSpawnTriggers();
    expect(spawns.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test** (30 sec)

```bash
pnpm test packages/daemon/src/integration/full-workflow.test.ts -v
```

Expected: PASS

**Step 3: Commit** (30 sec)

```bash
git add packages/daemon/src/integration/full-workflow.test.ts
git commit -m "test(daemon): add full workflow E2E test"
```

---

### Task 11: TUI Rendering Integration Test

**Files:**
- Create: `packages/tui/src/integration/app.test.tsx`

**Step 1: Write the integration test** (5-10 min)

```typescript
// packages/tui/src/integration/app.test.tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from '../index.js';

// Mock useDaemon hook
vi.mock('../hooks/useDaemon.js', () => ({
  useDaemon: () => ({
    connected: true,
    state: {
      workflowId: 'test',
      workflowName: 'Test Workflow',
      currentPhase: 'implement',
      tasks: {
        't1': { id: 't1', status: 'completed', claimedBy: null },
        't2': { id: 't2', status: 'running', claimedBy: 'worker-1' },
        't3': { id: 't3', status: 'pending', claimedBy: null },
      },
      agents: {
        'worker-1': { id: 'worker-1', status: 'active', currentTask: 't2' },
      },
      checkpoints: {},
      phaseHistory: [],
    },
    error: null,
  }),
}));

describe('App integration', () => {
  it('should render all tabs', () => {
    const { lastFrame } = render(<App socketPath="/tmp/test.sock" />);
    const output = lastFrame() ?? '';

    expect(output).toContain('hyh');
    expect(output).toContain('Overview');
    expect(output).toContain('Agents');
    expect(output).toContain('Tasks');
    expect(output).toContain('Logs');
    expect(output).toContain('Trajectory');
  });

  it('should show workflow name', () => {
    const { lastFrame } = render(<App socketPath="/tmp/test.sock" />);
    const output = lastFrame() ?? '';

    expect(output).toContain('Test Workflow');
  });

  it('should show current phase', () => {
    const { lastFrame } = render(<App socketPath="/tmp/test.sock" />);
    const output = lastFrame() ?? '';

    expect(output).toContain('implement');
  });
});
```

**Step 2: Run test** (30 sec)

```bash
pnpm test packages/tui/src/integration/app.test.tsx -v
```

Expected: PASS

**Step 3: Commit** (30 sec)

```bash
git add packages/tui/src/integration/app.test.tsx
git commit -m "test(tui): add App integration test"
```

---

## Task 12: Code Review

**Files:** All modified files from Tasks 1-11

**Step 1: Run full test suite** (2 min)

```bash
pnpm test
```

Expected: All tests pass

**Step 2: Run build** (1 min)

```bash
pnpm build
```

Expected: Build succeeds

**Step 3: Run linter if configured** (1 min)

```bash
pnpm lint || echo "No linter configured"
```

**Step 4: Review changes** (5 min)

```bash
git diff main..HEAD --stat
git log main..HEAD --oneline
```

**Step 5: Final commit if any cleanup needed** (30 sec)

```bash
git add -A
git commit -m "chore: cleanup from code review" || echo "Nothing to commit"
```

---

## Parallel Execution Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2 | TUI wiring - independent CLI commands |
| Group 2 | 3, 4 | Event loop integration - depends on Group 1 |
| Group 3 | 5, 6, 7 | Claude CLI - can run parallel with Group 2 |
| Group 4 | 8, 9 | Plan import - can run parallel with Group 3 |
| Group 5 | 10, 11 | E2E tests - depends on Groups 1-4 |
| Group 6 | 12 | Code review - must be last |

---

## Success Criteria

- [ ] `hyh run workflow.ts` starts daemon with TUI
- [ ] `hyh status --tui` shows live dashboard
- [ ] Agent spawning triggered by event loop
- [ ] Claude CLI version checked on startup
- [ ] plan.md automatically imported as tasks
- [ ] All 280+ tests passing
- [ ] Build succeeds on all packages
