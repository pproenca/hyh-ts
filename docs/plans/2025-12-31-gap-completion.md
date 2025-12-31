# hyh-ts Gap Completion Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-12-31-gap-completion.md` to implement task-by-task.

**Goal:** Complete the remaining gaps between current implementation and SPEC-1/2/3 specifications.

**Architecture:** The implementation is 85%+ complete with 234 passing tests across 4 packages (@hyh/dsl, @hyh/daemon, @hyh/cli, @hyh/tui). This plan addresses remaining gaps: missing CLI command registrations, TUI tabs (Logs, Trajectory), ApprovalDialog component, and missing CLI commands (simulate, metrics, resume).

**Tech Stack:** TypeScript, pnpm monorepo, Vitest, Commander.js, Ink (React for terminal)

---

## Gap Summary

| Category | Gap | Priority |
|----------|-----|----------|
| CLI | validate/heartbeat not registered | High (quick fix) |
| TUI | Logs tab placeholder | Medium |
| TUI | Trajectory tab placeholder | Medium |
| TUI | ApprovalDialog component | Medium |
| CLI | simulate command | Low |
| CLI | metrics command | Low |
| CLI | resume command | Medium |
| Core | Configuration system | Low |
| Core | MetricsCollector | Low |
| Core | RecoveryManager | Medium |

---

### Task 1: Register Missing CLI Commands

**Files:**
- Modify: `packages/cli/src/index.ts:1-35`

**Step 1: Read the current index.ts** (30 sec)

Verify current command registrations.

**Step 2: Add missing imports** (2 min)

```typescript
import { registerValidateCommand } from './commands/validate.js';
import { registerHeartbeatCommand } from './commands/heartbeat.js';
```

Add these imports after line 8.

**Step 3: Register the commands** (2 min)

```typescript
registerValidateCommand(program);
registerHeartbeatCommand(program);
```

Add after `registerDevCommand(program);`

**Step 4: Run tests to verify** (30 sec)

```bash
pnpm test packages/cli/src/commands/validate.test.ts packages/cli/src/commands/heartbeat.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/index.ts && git commit -m "fix(cli): register validate and heartbeat commands"
```

---

### Task 2: Implement TUI Logs Tab

**Files:**
- Create: `packages/tui/src/tabs/Logs.tsx`
- Create: `packages/tui/src/tabs/Logs.test.tsx`
- Modify: `packages/tui/src/index.tsx:14`

**Step 1: Write the test file** (5 min)

```tsx
// packages/tui/src/tabs/Logs.test.tsx
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { Logs } from './Logs.js';
import type { WorkflowState } from '@hyh/daemon';

describe('Logs tab', () => {
  const mockState: WorkflowState = {
    workflowId: 'test',
    workflowName: 'test-workflow',
    startedAt: Date.now(),
    currentPhase: 'implement',
    phaseHistory: [],
    queues: {},
    agents: {
      'worker-1': {
        id: 'worker-1',
        type: 'worker',
        status: 'active',
        currentTask: 'T001',
        pid: 1234,
        sessionId: 'session-1',
        lastHeartbeat: Date.now(),
        violationCounts: {},
      },
    },
    checkpoints: {},
    pendingHumanActions: [],
    recentLogs: [
      { timestamp: Date.now(), agentId: 'worker-1', message: 'Task started' },
      { timestamp: Date.now(), agentId: 'worker-1', message: 'Writing file' },
    ],
  };

  it('should render logs header', () => {
    const { lastFrame } = render(<Logs state={mockState} />);
    expect(lastFrame()).toContain('LOGS');
  });

  it('should render log entries', () => {
    const { lastFrame } = render(<Logs state={mockState} />);
    expect(lastFrame()).toContain('Task started');
    expect(lastFrame()).toContain('Writing file');
  });

  it('should handle null state', () => {
    const { lastFrame } = render(<Logs state={null} />);
    expect(lastFrame()).toContain('No workflow');
  });

  it('should handle empty logs', () => {
    const emptyState = { ...mockState, recentLogs: [] };
    const { lastFrame } = render(<Logs state={emptyState} />);
    expect(lastFrame()).toContain('No logs');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
pnpm test packages/tui/src/tabs/Logs.test.tsx
```

Expected: FAIL (Logs component doesn't exist)

**Step 3: Implement Logs component** (5 min)

```tsx
// packages/tui/src/tabs/Logs.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { WorkflowState } from '@hyh/daemon';

interface LogEntry {
  timestamp: number;
  agentId: string;
  message: string;
}

interface LogsProps {
  state: WorkflowState | null;
}

export function Logs({ state }: LogsProps) {
  if (!state) {
    return (
      <Box padding={1}>
        <Text dimColor>No workflow active</Text>
      </Box>
    );
  }

  const logs = (state as WorkflowState & { recentLogs?: LogEntry[] }).recentLogs ?? [];

  if (logs.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>LOGS</Text>
        <Text dimColor>No logs yet</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>LOGS</Text>
      <Box flexDirection="column" marginTop={1}>
        {logs.slice(-20).map((log, i) => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          return (
            <Text key={i}>
              <Text dimColor>{time}</Text>
              <Text color="cyan"> {log.agentId}</Text>
              <Text> {log.message}</Text>
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify pass** (30 sec)

```bash
pnpm test packages/tui/src/tabs/Logs.test.tsx
```

Expected: PASS

**Step 5: Update index.tsx to use Logs** (2 min)

In `packages/tui/src/index.tsx`, add import and update TAB_COMPONENTS:

```typescript
import { Logs } from './tabs/Logs.js';
// ...
const TAB_COMPONENTS: TabComponent[] = [Overview, Agents, Tasks, Logs, Overview];
```

**Step 6: Run all TUI tests** (30 sec)

```bash
pnpm test packages/tui
```

Expected: All PASS

**Step 7: Commit** (30 sec)

```bash
git add packages/tui/src/tabs/Logs.tsx packages/tui/src/tabs/Logs.test.tsx packages/tui/src/index.tsx
git commit -m "feat(tui): implement Logs tab"
```

---

### Task 3: Implement TUI Trajectory Tab

**Files:**
- Create: `packages/tui/src/tabs/Trajectory.tsx`
- Create: `packages/tui/src/tabs/Trajectory.test.tsx`
- Modify: `packages/tui/src/index.tsx:14`

**Step 1: Write the test file** (5 min)

```tsx
// packages/tui/src/tabs/Trajectory.test.tsx
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect } from 'vitest';
import { Trajectory } from './Trajectory.js';
import type { WorkflowState } from '@hyh/daemon';

describe('Trajectory tab', () => {
  const mockState: WorkflowState = {
    workflowId: 'test',
    workflowName: 'test-workflow',
    startedAt: Date.now(),
    currentPhase: 'implement',
    phaseHistory: [],
    queues: {},
    agents: {},
    checkpoints: {},
    pendingHumanActions: [],
    trajectory: [
      { type: 'spawn', timestamp: Date.now(), agentId: 'worker-1', agentType: 'worker' },
      { type: 'tool_use', timestamp: Date.now(), agentId: 'worker-1', tool: 'Read', args: { path: 'src/foo.ts' } },
    ],
  };

  it('should render trajectory header', () => {
    const { lastFrame } = render(<Trajectory state={mockState} />);
    expect(lastFrame()).toContain('TRAJECTORY');
  });

  it('should render trajectory events', () => {
    const { lastFrame } = render(<Trajectory state={mockState} />);
    expect(lastFrame()).toContain('spawn');
    expect(lastFrame()).toContain('tool_use');
  });

  it('should handle null state', () => {
    const { lastFrame } = render(<Trajectory state={null} />);
    expect(lastFrame()).toContain('No workflow');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
pnpm test packages/tui/src/tabs/Trajectory.test.tsx
```

Expected: FAIL

**Step 3: Implement Trajectory component** (5 min)

```tsx
// packages/tui/src/tabs/Trajectory.tsx
import React from 'react';
import { Box, Text } from 'ink';
import type { WorkflowState, TrajectoryEvent } from '@hyh/daemon';

interface TrajectoryProps {
  state: WorkflowState | null;
}

export function Trajectory({ state }: TrajectoryProps) {
  if (!state) {
    return (
      <Box padding={1}>
        <Text dimColor>No workflow active</Text>
      </Box>
    );
  }

  const events = (state as WorkflowState & { trajectory?: TrajectoryEvent[] }).trajectory ?? [];

  if (events.length === 0) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>TRAJECTORY</Text>
        <Text dimColor>No events recorded</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>TRAJECTORY</Text>
      <Text dimColor>{events.length} events</Text>
      <Box flexDirection="column" marginTop={1}>
        {events.slice(-15).map((event, i) => {
          const time = new Date(event.timestamp).toLocaleTimeString();
          return (
            <Text key={i}>
              <Text dimColor>{time}</Text>
              <Text color="yellow"> [{event.type}]</Text>
              <Text color="cyan"> {event.agentId}</Text>
              {'tool' in event && <Text> {event.tool}</Text>}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify pass** (30 sec)

```bash
pnpm test packages/tui/src/tabs/Trajectory.test.tsx
```

Expected: PASS

**Step 5: Update index.tsx to use Trajectory** (2 min)

```typescript
import { Trajectory } from './tabs/Trajectory.js';
// ...
const TAB_COMPONENTS: TabComponent[] = [Overview, Agents, Tasks, Logs, Trajectory];
```

**Step 6: Run all TUI tests** (30 sec)

```bash
pnpm test packages/tui
```

Expected: All PASS

**Step 7: Commit** (30 sec)

```bash
git add packages/tui/src/tabs/Trajectory.tsx packages/tui/src/tabs/Trajectory.test.tsx packages/tui/src/index.tsx
git commit -m "feat(tui): implement Trajectory tab"
```

---

### Task 4: Implement ApprovalDialog Component

**Files:**
- Create: `packages/tui/src/components/ApprovalDialog.tsx`
- Create: `packages/tui/src/components/ApprovalDialog.test.tsx`

**Step 1: Write the test file** (5 min)

```tsx
// packages/tui/src/components/ApprovalDialog.test.tsx
import React from 'react';
import { render } from 'ink-testing-library';
import { describe, it, expect, vi } from 'vitest';
import { ApprovalDialog } from './ApprovalDialog.js';

describe('ApprovalDialog', () => {
  const mockCheckpoint = {
    id: 'cp-1',
    question: 'Ready to merge?',
  };

  it('should render the question', () => {
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={mockCheckpoint} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('Ready to merge?');
  });

  it('should show approve/reject options', () => {
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={mockCheckpoint} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('Approve');
    expect(lastFrame()).toContain('Reject');
  });

  it('should show default question when none provided', () => {
    const { lastFrame } = render(
      <ApprovalDialog checkpoint={{ id: 'cp-2' }} onAction={vi.fn()} />
    );
    expect(lastFrame()).toContain('Approve to continue?');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
pnpm test packages/tui/src/components/ApprovalDialog.test.tsx
```

Expected: FAIL

**Step 3: Implement ApprovalDialog** (5 min)

```tsx
// packages/tui/src/components/ApprovalDialog.tsx
import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Checkpoint {
  id: string;
  question?: string;
}

interface ApprovalDialogProps {
  checkpoint: Checkpoint;
  onAction: (action: 'approve' | 'reject') => void;
}

export function ApprovalDialog({ checkpoint, onAction }: ApprovalDialogProps) {
  useInput((input) => {
    if (input === 'y' || input === 'Y') {
      onAction('approve');
    } else if (input === 'n' || input === 'N') {
      onAction('reject');
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      padding={1}
    >
      <Text bold color="yellow">Human Action Required</Text>
      <Box marginTop={1}>
        <Text>{checkpoint.question || 'Approve to continue?'}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>[Y] Approve  [N] Reject</Text>
      </Box>
    </Box>
  );
}
```

**Step 4: Run test to verify pass** (30 sec)

```bash
pnpm test packages/tui/src/components/ApprovalDialog.test.tsx
```

Expected: PASS

**Step 5: Run all TUI tests** (30 sec)

```bash
pnpm test packages/tui
```

Expected: All PASS

**Step 6: Commit** (30 sec)

```bash
git add packages/tui/src/components/ApprovalDialog.tsx packages/tui/src/components/ApprovalDialog.test.tsx
git commit -m "feat(tui): add ApprovalDialog component for human checkpoints"
```

---

### Task 5: Add recentLogs to WorkflowState Type

**Files:**
- Modify: `packages/daemon/src/types/state.ts`

**Step 1: Read current state.ts** (30 sec)

Review the WorkflowState interface.

**Step 2: Write test for recentLogs** (3 min)

Add to `packages/daemon/src/types/state.test.ts`:

```typescript
it('should support recentLogs field', () => {
  const state: WorkflowState = {
    workflowId: 'test',
    workflowName: 'test',
    startedAt: Date.now(),
    currentPhase: 'plan',
    phaseHistory: [],
    queues: {},
    agents: {},
    checkpoints: {},
    pendingHumanActions: [],
    recentLogs: [
      { timestamp: Date.now(), agentId: 'worker-1', message: 'test' },
    ],
  };
  expect(state.recentLogs).toHaveLength(1);
});
```

**Step 3: Run test to verify failure** (30 sec)

```bash
pnpm test packages/daemon/src/types/state.test.ts
```

Expected: FAIL (recentLogs not in type)

**Step 4: Add recentLogs to WorkflowState** (2 min)

Add to the WorkflowState interface:

```typescript
recentLogs?: Array<{
  timestamp: number;
  agentId: string;
  message: string;
}>;
```

**Step 5: Run test to verify pass** (30 sec)

```bash
pnpm test packages/daemon/src/types/state.test.ts
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add packages/daemon/src/types/state.ts packages/daemon/src/types/state.test.ts
git commit -m "feat(daemon): add recentLogs field to WorkflowState"
```

---

### Task 6: Implement CLI Resume Command

**Files:**
- Create: `packages/cli/src/commands/resume.ts`
- Create: `packages/cli/src/commands/resume.test.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Write the test file** (5 min)

```typescript
// packages/cli/src/commands/resume.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import { registerResumeCommand } from './resume.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

vi.mock('node:fs/promises');
vi.mock('./run.js', () => ({
  startWorkflow: vi.fn(),
}));

describe('hyh resume', () => {
  let program: Command;

  beforeEach(() => {
    program = new Command();
    registerResumeCommand(program);
    vi.clearAllMocks();
  });

  it('should register resume command', () => {
    const cmd = program.commands.find((c) => c.name() === 'resume');
    expect(cmd).toBeDefined();
    expect(cmd?.description()).toContain('Resume');
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
pnpm test packages/cli/src/commands/resume.test.ts
```

Expected: FAIL

**Step 3: Implement resume command** (5 min)

```typescript
// packages/cli/src/commands/resume.ts
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export function registerResumeCommand(program: Command): void {
  program
    .command('resume')
    .description('Resume a workflow from saved state')
    .option('-d, --dir <dir>', 'Project directory', '.')
    .action(async (options: { dir: string }) => {
      const projectDir = path.resolve(options.dir);
      const stateFile = path.join(projectDir, '.hyh', 'state.json');

      try {
        await fs.access(stateFile);
      } catch {
        console.error('No saved state found');
        console.error(`Looking for: ${stateFile}`);
        process.exit(1);
      }

      console.log('Resuming workflow from saved state...');
      console.log(`State file: ${stateFile}`);

      // Load and validate state
      const stateContent = await fs.readFile(stateFile, 'utf-8');
      const state = JSON.parse(stateContent);

      console.log(`Workflow: ${state.workflowName || 'Unknown'}`);
      console.log(`Phase: ${state.currentPhase || 'Unknown'}`);

      // TODO: Start daemon with resumeFrom option
      console.log('Resume not fully implemented yet');
    });
}
```

**Step 4: Run test to verify pass** (30 sec)

```bash
pnpm test packages/cli/src/commands/resume.test.ts
```

Expected: PASS

**Step 5: Register command in index.ts** (2 min)

Add import and registration to `packages/cli/src/index.ts`:

```typescript
import { registerResumeCommand } from './commands/resume.js';
// ...
registerResumeCommand(program);
```

**Step 6: Run all CLI tests** (30 sec)

```bash
pnpm test packages/cli
```

Expected: All PASS

**Step 7: Commit** (30 sec)

```bash
git add packages/cli/src/commands/resume.ts packages/cli/src/commands/resume.test.ts packages/cli/src/index.ts
git commit -m "feat(cli): add resume command for workflow resumability"
```

---

### Task 7: Implement CLI Logs Command

**Files:**
- Create: `packages/cli/src/commands/logs.ts`
- Create: `packages/cli/src/commands/logs.test.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Write the test file** (3 min)

```typescript
// packages/cli/src/commands/logs.test.ts
import { describe, it, expect, vi } from 'vitest';
import { Command } from 'commander';
import { registerLogsCommand } from './logs.js';

vi.mock('../ipc/client.js');
vi.mock('../utils/socket.js');

describe('hyh logs', () => {
  it('should register logs command', () => {
    const program = new Command();
    registerLogsCommand(program);
    const cmd = program.commands.find((c) => c.name() === 'logs');
    expect(cmd).toBeDefined();
  });
});
```

**Step 2: Run test to verify failure** (30 sec)

```bash
pnpm test packages/cli/src/commands/logs.test.ts
```

Expected: FAIL

**Step 3: Implement logs command** (5 min)

```typescript
// packages/cli/src/commands/logs.ts
import { Command } from 'commander';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath } from '../utils/socket.js';

export function registerLogsCommand(program: Command): void {
  program
    .command('logs')
    .description('Stream workflow logs')
    .option('-n, --lines <n>', 'Number of lines', '20')
    .option('-f, --follow', 'Follow log output')
    .option('--agent <id>', 'Filter by agent ID')
    .action(async (options: { lines: string; follow?: boolean; agent?: string }) => {
      const socketPath = await findSocketPath();
      if (!socketPath) {
        console.error('No active workflow');
        process.exit(1);
      }

      const client = new IPCClient(socketPath);

      try {
        await client.connect();
        const response = await client.request({
          command: 'get_logs',
          limit: parseInt(options.lines),
          agentId: options.agent,
        });

        if (response.status === 'ok') {
          const logs = response.data?.logs ?? [];
          for (const log of logs) {
            const time = new Date(log.timestamp).toLocaleTimeString();
            console.log(`${time} [${log.agentId}] ${log.message}`);
          }

          if (options.follow) {
            console.log('Following logs... (Ctrl+C to exit)');
            // Subscribe to log events
            client.on('log', (log: { timestamp: number; agentId: string; message: string }) => {
              const time = new Date(log.timestamp).toLocaleTimeString();
              console.log(`${time} [${log.agentId}] ${log.message}`);
            });
          } else {
            await client.disconnect();
          }
        } else {
          console.error('Failed to get logs:', response.message);
          process.exit(1);
        }
      } catch (error) {
        console.error('Error:', (error as Error).message);
        await client.disconnect();
        process.exit(1);
      }
    });
}
```

**Step 4: Run test to verify pass** (30 sec)

```bash
pnpm test packages/cli/src/commands/logs.test.ts
```

Expected: PASS

**Step 5: Register in index.ts** (2 min)

```typescript
import { registerLogsCommand } from './commands/logs.js';
// ...
registerLogsCommand(program);
```

**Step 6: Commit** (30 sec)

```bash
git add packages/cli/src/commands/logs.ts packages/cli/src/commands/logs.test.ts packages/cli/src/index.ts
git commit -m "feat(cli): add logs command for streaming workflow logs"
```

---

### Task 8: Code Review

Run full test suite and typecheck to ensure all implementations work together.

**Step 1: Run all tests** (2 min)

```bash
pnpm test
```

Expected: All 234+ tests PASS

**Step 2: Run typecheck** (1 min)

```bash
pnpm typecheck
```

Expected: No errors

**Step 3: Run lint** (1 min)

```bash
pnpm lint
```

Expected: No errors

**Step 4: Create summary commit if needed** (30 sec)

If any fixups needed:
```bash
git add -A && git commit -m "fix: address code review feedback"
```

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Quick CLI registration fix |
| Group 2 | 2, 3, 4 | TUI tabs are independent |
| Group 3 | 5 | Type changes needed for TUI |
| Group 4 | 6, 7 | CLI commands are independent |
| Group 5 | 8 | Code review after all tasks |

---

## Future Tasks (Not in This Plan)

These items from SPEC-3 are deferred:

1. **hyh simulate** - Mock agent simulation
2. **hyh metrics** - Metrics collection and display
3. **Configuration system** - hyh.config.ts loading
4. **MetricsCollector** - Token counting, timing metrics
5. **RecoveryManager** - Full crash recovery with session resume
6. **DSL extensions** - .scaling(), .preCompact(), .contextBudget()

---

## Verification Checklist

Before considering this plan complete, verify:

- [ ] `pnpm test` passes with 240+ tests
- [ ] `pnpm typecheck` passes
- [ ] `hyh validate` command works
- [ ] `hyh heartbeat` command works
- [ ] TUI shows Logs tab with real content
- [ ] TUI shows Trajectory tab with real content
- [ ] `hyh resume` command exists
- [ ] `hyh logs` command exists
