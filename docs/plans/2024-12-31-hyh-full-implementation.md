# hyh-ts Full Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2024-12-31-hyh-full-implementation.md` to implement task-by-task.

**Goal:** Complete the hyh TypeScript workflow orchestration system - a DSL for defining multi-agent Claude Code workflows with runtime enforcement, CLI tooling, and observability.

**Architecture:** Three-package monorepo (@hyh/dsl, @hyh/daemon, @hyh/cli) with fluent DSL compiling to runtime checkers. Daemon manages Claude CLI processes, enforces invariants via trajectory analysis, and communicates via Unix socket IPC. CLI provides user commands and agent-callable APIs.

**Tech Stack:** TypeScript 5.7+, pnpm workspaces, Vitest, Zod validation, Commander.js CLI, Node.js child_process for agent spawning, async-mutex for state locking.

**Current State:** DSL builders and daemon core exist with 58 passing tests. Missing: compiler, prompt generator, CLI package, agent spawning, invariant checkers.

---

## Phase 1: DSL Completion

### Task 1: DSL Compiler - Workflow to JSON

**Files:**
- Create: `packages/dsl/src/compiler/index.ts`
- Create: `packages/dsl/src/compiler/compiler.test.ts`
- Modify: `packages/dsl/src/index.ts:12-32`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/dsl/src/compiler/compiler.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from './index.js';
import { workflow, agent, queue, inv, correct } from '../index.js';

describe('DSL Compiler', () => {
  it('compiles workflow to JSON structure', () => {
    const orchestrator = agent('orchestrator')
      .model('opus')
      .role('coordinator')
      .tools('Read', 'Grep');

    const wf = workflow('test-feature')
      .resumable()
      .orchestrator(orchestrator)
      .phase('explore')
        .agent(orchestrator)
        .expects('Read', 'Grep')
        .forbids('Write')
        .output('architecture.md')
      .build();

    const compiled = compile(wf);

    expect(compiled.name).toBe('test-feature');
    expect(compiled.resumable).toBe(true);
    expect(compiled.orchestrator).toBe('orchestrator');
    expect(compiled.phases).toHaveLength(1);
    expect(compiled.phases[0].expects).toContain('Read');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/compiler.test.ts
```

Expected: FAIL with `Cannot find module './index.js'`

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/dsl/src/compiler/index.ts
import { CompiledWorkflow } from '../types/compiled.js';

export interface CompileOptions {
  outputDir?: string;
  validate?: boolean;
}

export function compile(
  workflow: CompiledWorkflow,
  options: CompileOptions = {}
): CompiledWorkflow {
  if (options.validate !== false) {
    validateWorkflow(workflow);
  }
  return workflow;
}

function validateWorkflow(workflow: CompiledWorkflow): void {
  if (!workflow.name) {
    throw new Error('Workflow must have a name');
  }
  if (!workflow.orchestrator) {
    throw new Error('Workflow must have an orchestrator');
  }
  if (workflow.phases.length === 0) {
    throw new Error('Workflow must have at least one phase');
  }

  // Validate phase references
  for (const phase of workflow.phases) {
    if (!workflow.agents[phase.agent]) {
      throw new Error(`Phase '${phase.name}' references unknown agent '${phase.agent}'`);
    }
    if (phase.queue && !workflow.queues[phase.queue]) {
      throw new Error(`Phase '${phase.name}' references unknown queue '${phase.queue}'`);
    }
    if (phase.gate && !workflow.gates[phase.gate]) {
      throw new Error(`Phase '${phase.name}' references unknown gate '${phase.gate}'`);
    }
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/compiler.test.ts
```

Expected: PASS (1 passed)

**Step 5: Export from package index** (2 min)

Add to `packages/dsl/src/index.ts`:

```typescript
export { compile } from './compiler/index.js';
export type { CompileOptions } from './compiler/index.js';
```

**Step 6: Commit** (30 sec)

```bash
git add packages/dsl/src/compiler packages/dsl/src/index.ts
git commit -m "feat(dsl): add workflow compiler with validation"
```

---

### Task 2: DSL Compiler - Write to Disk

**Files:**
- Modify: `packages/dsl/src/compiler/index.ts:1-50`
- Modify: `packages/dsl/src/compiler/compiler.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// Add to compiler.test.ts
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { compileToDir } from './index.js';

describe('compileToDir', () => {
  it('writes workflow.json to output directory', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));

    const orchestrator = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orchestrator)
      .phase('plan')
        .agent(orchestrator)
      .build();

    await compileToDir(wf, tmpDir);

    const workflowJson = await fs.readFile(
      path.join(tmpDir, 'workflow.json'),
      'utf-8'
    );
    const parsed = JSON.parse(workflowJson);
    expect(parsed.name).toBe('test');

    // Cleanup
    await fs.rm(tmpDir, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/compiler.test.ts
```

Expected: FAIL with `compileToDir is not a function`

**Step 3: Write minimal implementation** (4 min)

```typescript
// Add to packages/dsl/src/compiler/index.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export async function compileToDir(
  workflow: CompiledWorkflow,
  outputDir: string,
  options: CompileOptions = {}
): Promise<void> {
  const compiled = compile(workflow, options);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  // Write workflow.json
  const workflowPath = path.join(outputDir, 'workflow.json');
  await fs.writeFile(workflowPath, JSON.stringify(compiled, null, 2));
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/compiler.test.ts
```

Expected: PASS

**Step 5: Update exports** (1 min)

```typescript
// packages/dsl/src/index.ts
export { compile, compileToDir } from './compiler/index.js';
```

**Step 6: Commit** (30 sec)

```bash
git add packages/dsl/src/compiler packages/dsl/src/index.ts
git commit -m "feat(dsl): add compileToDir for writing workflow artifacts"
```

---

### Task 3: Agent Prompt Generator

**Files:**
- Create: `packages/dsl/src/compiler/prompt-generator.ts`
- Create: `packages/dsl/src/compiler/prompt-generator.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/dsl/src/compiler/prompt-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateAgentPrompt } from './prompt-generator.js';
import { agent, inv, correct } from '../index.js';

describe('generateAgentPrompt', () => {
  it('generates markdown prompt for agent', () => {
    const worker = agent('worker')
      .model('sonnet')
      .role('implementation')
      .tools('Read', 'Write', 'Edit', 'Bash(npm:*)')
      .invariants(
        inv.tdd({ test: '**/*.test.ts', impl: 'src/**/*.ts' }),
        inv.fileScope(ctx => ctx.task.files)
      )
      .build();

    const prompt = generateAgentPrompt(worker);

    expect(prompt).toContain('# worker Agent');
    expect(prompt).toContain('**Role**: implementation');
    expect(prompt).toContain('**Model**: sonnet');
    expect(prompt).toContain('hyh task claim');
    expect(prompt).toContain('tdd');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/prompt-generator.test.ts
```

Expected: FAIL with `Cannot find module`

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/dsl/src/compiler/prompt-generator.ts
import { CompiledAgent } from '../types/compiled.js';

export function generateAgentPrompt(agent: CompiledAgent): string {
  const lines: string[] = [];

  lines.push(`# ${agent.name} Agent`);
  lines.push('');
  lines.push('## Identity');
  lines.push(`- **Role**: ${agent.role}`);
  lines.push(`- **Model**: ${agent.model}`);
  lines.push('');

  lines.push('## Workflow');
  lines.push('');
  lines.push('### Getting Work');
  lines.push('```bash');
  lines.push(`hyh task claim${agent.role ? ` --role ${agent.role}` : ''}`);
  lines.push('```');
  lines.push('You will receive a JSON task object with instructions.');
  lines.push('');

  if (agent.heartbeat) {
    const intervalSec = Math.round(agent.heartbeat.interval / 1000);
    lines.push('### Heartbeat');
    lines.push(`Run \`hyh heartbeat\` every ${intervalSec} seconds.`);
    lines.push('');
  }

  lines.push('### Completing Work');
  lines.push('```bash');
  lines.push('hyh task complete --id <task-id>');
  lines.push('```');
  lines.push('');

  if (agent.invariants.length > 0) {
    lines.push('## Constraints');
    lines.push('');
    for (const inv of agent.invariants) {
      lines.push(`### ${inv.type}`);
      lines.push(getInvariantDescription(inv.type, inv.options));
      lines.push('');
    }
  }

  lines.push('## Tools Available');
  for (const tool of agent.tools) {
    const toolName = typeof tool === 'string' ? tool : `${tool.tool}(${tool.pattern})`;
    lines.push(`- ${toolName}`);
  }
  lines.push('');

  return lines.join('\n');
}

function getInvariantDescription(type: string, options?: Record<string, unknown>): string {
  switch (type) {
    case 'tdd':
      return `You MUST write failing tests before implementation.\n- Test files: ${options?.test ?? '**/*.test.ts'}\n- Impl files: ${options?.impl ?? 'src/**/*.ts'}`;
    case 'fileScope':
      return 'You may ONLY modify files listed in your task scope.';
    case 'noCode':
      return 'You may NOT write or modify code files.';
    case 'readOnly':
      return 'You may NOT write or edit any files.';
    case 'mustProgress':
      return `You must show progress within ${Math.round((options?.timeout as number ?? 600000) / 60000)} minutes.`;
    default:
      return `Constraint: ${type}`;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/prompt-generator.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/dsl/src/compiler/prompt-generator.ts packages/dsl/src/compiler/prompt-generator.test.ts
git commit -m "feat(dsl): add agent prompt generator"
```

---

### Task 4: Hooks.json Generator

**Files:**
- Create: `packages/dsl/src/compiler/hooks-generator.ts`
- Create: `packages/dsl/src/compiler/hooks-generator.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/dsl/src/compiler/hooks-generator.test.ts
import { describe, it, expect } from 'vitest';
import { generateHooksJson } from './hooks-generator.js';
import { workflow, agent } from '../index.js';

describe('generateHooksJson', () => {
  it('generates hooks config with SessionStart and Stop', () => {
    const orch = agent('orchestrator').model('opus').role('coordinator');
    const wf = workflow('test')
      .orchestrator(orch)
      .phase('plan').agent(orch)
      .build();

    const hooks = generateHooksJson(wf);

    expect(hooks.hooks).toBeDefined();
    expect(hooks.hooks.SessionStart).toBeDefined();
    expect(hooks.hooks.Stop).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/hooks-generator.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (4 min)

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

  return hooks;
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/hooks-generator.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/dsl/src/compiler/hooks-generator.ts packages/dsl/src/compiler/hooks-generator.test.ts
git commit -m "feat(dsl): add hooks.json generator"
```

---

### Task 5: Integrate Generators into compileToDir

**Files:**
- Modify: `packages/dsl/src/compiler/index.ts`
- Modify: `packages/dsl/src/compiler/compiler.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// Add to compiler.test.ts
describe('compileToDir with all artifacts', () => {
  it('writes workflow.json, agent prompts, and hooks.json', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-test-'));

    const orchestrator = agent('orchestrator').model('opus').role('coordinator');
    const worker = agent('worker').model('sonnet').role('implementation');

    const wf = workflow('test')
      .orchestrator(orchestrator)
      .phase('plan').agent(orchestrator)
      .phase('impl').agent(worker)
      .build();

    // Register worker agent
    wf.agents['worker'] = worker.build();

    await compileToDir(wf, tmpDir);

    // Check all files exist
    const files = await fs.readdir(tmpDir);
    expect(files).toContain('workflow.json');
    expect(files).toContain('hooks.json');

    const agentsDir = await fs.readdir(path.join(tmpDir, 'agents'));
    expect(agentsDir).toContain('orchestrator.md');
    expect(agentsDir).toContain('worker.md');

    await fs.rm(tmpDir, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/compiler.test.ts
```

Expected: FAIL (agents directory doesn't exist)

**Step 3: Update compileToDir implementation** (4 min)

```typescript
// Update packages/dsl/src/compiler/index.ts
import { generateAgentPrompt } from './prompt-generator.js';
import { generateHooksJson } from './hooks-generator.js';

export async function compileToDir(
  workflow: CompiledWorkflow,
  outputDir: string,
  options: CompileOptions = {}
): Promise<void> {
  const compiled = compile(workflow, options);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.join(outputDir, 'agents'), { recursive: true });

  // Write workflow.json
  const workflowPath = path.join(outputDir, 'workflow.json');
  await fs.writeFile(workflowPath, JSON.stringify(compiled, null, 2));

  // Write agent prompts
  for (const [name, agentDef] of Object.entries(compiled.agents)) {
    const prompt = generateAgentPrompt(agentDef);
    const promptPath = path.join(outputDir, 'agents', `${name}.md`);
    await fs.writeFile(promptPath, prompt);
  }

  // Write hooks.json
  const hooks = generateHooksJson(compiled);
  const hooksPath = path.join(outputDir, 'hooks.json');
  await fs.writeFile(hooksPath, JSON.stringify(hooks, null, 2));
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/dsl/src/compiler/compiler.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/dsl/src/compiler
git commit -m "feat(dsl): integrate prompt and hooks generators into compileToDir"
```

---

## Phase 2: CLI Package Foundation

### Task 6: Create CLI Package Structure

**Files:**
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/src/index.ts`
- Modify: `pnpm-workspace.yaml` (no change needed, already covers packages/*)

**Step 1: Create package.json** (3 min)

```json
{
  "name": "@hyh/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "hyh": "./dist/index.js"
  },
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@hyh/dsl": "workspace:*",
    "@hyh/daemon": "workspace:*",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

**Step 2: Create tsconfig.json** (2 min)

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create minimal entry point** (2 min)

```typescript
// packages/cli/src/index.ts
#!/usr/bin/env node
import { Command } from 'commander';

const program = new Command();

program
  .name('hyh')
  .description('Hold Your Horses - Workflow Orchestration CLI')
  .version('0.1.0');

program
  .command('version')
  .description('Show version')
  .action(() => {
    console.log('hyh v0.1.0');
  });

program.parse();
```

**Step 4: Install dependencies and build** (1 min)

```bash
pnpm install
pnpm -r build
```

**Step 5: Test CLI runs** (30 sec)

```bash
node packages/cli/dist/index.js version
```

Expected: `hyh v0.1.0`

**Step 6: Commit** (30 sec)

```bash
git add packages/cli
git commit -m "feat(cli): create CLI package with Commander.js"
```

---

### Task 7: CLI - IPC Client

**Files:**
- Create: `packages/cli/src/ipc/client.ts`
- Create: `packages/cli/src/ipc/client.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/cli/src/ipc/client.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { IPCClient } from './client.js';
import { Daemon } from '@hyh/daemon';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

describe('IPCClient', () => {
  let daemon: Daemon;
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-ipc-test-'));
    daemon = new Daemon({ worktreeRoot: tmpDir });
    await daemon.start();
  });

  afterAll(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true });
  });

  it('connects and sends ping request', async () => {
    const client = new IPCClient(daemon.getSocketPath());
    await client.connect();

    const response = await client.request({ command: 'ping' });

    expect(response.status).toBe('ok');
    expect(response.data.running).toBe(true);

    await client.disconnect();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/cli/src/ipc/client.test.ts
```

Expected: FAIL with `Cannot find module`

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/cli/src/ipc/client.ts
import * as net from 'node:net';
import { IPCRequest, IPCResponse } from '@hyh/daemon';

export class IPCClient {
  private socket: net.Socket | null = null;
  private readonly socketPath: string;
  private buffer: string = '';
  private pendingResolve: ((response: IPCResponse) => void) | null = null;

  constructor(socketPath: string) {
    this.socketPath = socketPath;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(this.socketPath);

      this.socket.on('connect', () => resolve());
      this.socket.on('error', reject);

      this.socket.on('data', (data) => {
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() && this.pendingResolve) {
            const response = JSON.parse(line) as IPCResponse;
            this.pendingResolve(response);
            this.pendingResolve = null;
          }
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  async request(req: IPCRequest): Promise<IPCResponse> {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
      this.socket!.write(JSON.stringify(req) + '\n');
    });
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/cli/src/ipc/client.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src/ipc
git commit -m "feat(cli): add IPC client for daemon communication"
```

---

### Task 8: CLI - Status Command

**Files:**
- Create: `packages/cli/src/commands/status.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Write the status command** (4 min)

```typescript
// packages/cli/src/commands/status.ts
import { Command } from 'commander';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath } from '../utils/socket.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show workflow status')
    .option('-q, --quiet', 'Minimal output')
    .option('-n, --events <count>', 'Number of recent events to show', '10')
    .action(async (options) => {
      const socketPath = await findSocketPath();
      if (!socketPath) {
        if (!options.quiet) {
          console.log('No active workflow');
        }
        return;
      }

      const client = new IPCClient(socketPath);
      try {
        await client.connect();
        const response = await client.request({
          command: 'status',
          eventCount: parseInt(options.events, 10),
        });

        if (response.status === 'error') {
          console.error('Error:', response.message);
          process.exit(1);
        }

        const data = response.data as {
          active: boolean;
          summary: { total: number; completed: number; running: number; pending: number };
          activeWorkers: string[];
        };

        if (options.quiet) {
          console.log(data.active ? 'active' : 'inactive');
          return;
        }

        console.log(`Workflow Status: ${data.active ? 'Active' : 'Inactive'}`);
        console.log(`Tasks: ${data.summary.completed}/${data.summary.total} completed`);
        console.log(`  Running: ${data.summary.running}`);
        console.log(`  Pending: ${data.summary.pending}`);
        if (data.activeWorkers.length > 0) {
          console.log(`Active Workers: ${data.activeWorkers.join(', ')}`);
        }
      } finally {
        await client.disconnect();
      }
    });
}
```

**Step 2: Create socket finder utility** (3 min)

```typescript
// packages/cli/src/utils/socket.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

export async function findSocketPath(): Promise<string | null> {
  const socketsDir = path.join(os.homedir(), '.hyh', 'sockets');

  try {
    const files = await fs.readdir(socketsDir);
    const sockets = files.filter(f => f.endsWith('.sock'));

    if (sockets.length === 0) {
      return null;
    }

    // Return first socket (in production, match by worktree)
    return path.join(socketsDir, sockets[0]);
  } catch {
    return null;
  }
}

export function getSocketPathForWorktree(worktreeRoot: string): string {
  const hash = crypto.createHash('sha256').update(worktreeRoot).digest('hex').slice(0, 16);
  return path.join(os.homedir(), '.hyh', 'sockets', `${hash}.sock`);
}
```

**Step 3: Update CLI entry point** (2 min)

```typescript
// packages/cli/src/index.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { registerStatusCommand } from './commands/status.js';

const program = new Command();

program
  .name('hyh')
  .description('Hold Your Horses - Workflow Orchestration CLI')
  .version('0.1.0');

registerStatusCommand(program);

program.parse();
```

**Step 4: Build and test** (1 min)

```bash
pnpm -r build
node packages/cli/dist/index.js status --quiet
```

Expected: `No active workflow` or `inactive`

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src
git commit -m "feat(cli): add status command with IPC client"
```

---

### Task 9: CLI - Task Claim Command

**Files:**
- Create: `packages/cli/src/commands/task.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Write the task command** (5 min)

```typescript
// packages/cli/src/commands/task.ts
import { Command } from 'commander';
import { IPCClient } from '../ipc/client.js';
import { findSocketPath, getSocketPathForWorktree } from '../utils/socket.js';
import { getWorkerId } from '../utils/worker-id.js';

export function registerTaskCommand(program: Command): void {
  const taskCmd = program
    .command('task')
    .description('Task management commands');

  taskCmd
    .command('claim')
    .description('Claim a task for this worker')
    .option('--role <role>', 'Filter by role')
    .action(async (options) => {
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
          command: 'task_claim',
          workerId,
          role: options.role,
        });

        if (response.status === 'error') {
          console.error('Error:', response.message);
          process.exit(1);
        }

        const data = response.data as { task: unknown; isRetry: boolean; isReclaim: boolean };

        if (!data.task) {
          console.log('No tasks available');
          process.exit(0);
        }

        // Output task as JSON for agent consumption
        console.log(JSON.stringify(data.task, null, 2));

        if (data.isRetry) {
          console.error('\n[Retrying previous task]');
        }
        if (data.isReclaim) {
          console.error('\n[Reclaiming timed-out task]');
        }
      } finally {
        await client.disconnect();
      }
    });

  taskCmd
    .command('complete')
    .description('Mark a task as complete')
    .requiredOption('--id <taskId>', 'Task ID to complete')
    .option('--force', 'Force complete even if not owned')
    .action(async (options) => {
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
          command: 'task_complete',
          taskId: options.id,
          workerId,
          force: options.force ?? false,
        });

        if (response.status === 'error') {
          console.error('Error:', response.message);
          process.exit(1);
        }

        console.log(`Task ${options.id} completed`);
      } finally {
        await client.disconnect();
      }
    });
}
```

**Step 2: Create worker ID utility** (3 min)

```typescript
// packages/cli/src/utils/worker-id.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import * as crypto from 'node:crypto';

const WORKER_ID_FILE = path.join(os.homedir(), '.hyh', 'worker-id');

export async function getWorkerId(): Promise<string> {
  // Check environment override
  if (process.env.HYH_WORKER_ID) {
    return process.env.HYH_WORKER_ID;
  }

  // Try to read existing ID
  try {
    const id = await fs.readFile(WORKER_ID_FILE, 'utf-8');
    return id.trim();
  } catch {
    // Generate new ID
    const id = `worker-${crypto.randomBytes(6).toString('hex')}`;

    // Persist atomically
    await fs.mkdir(path.dirname(WORKER_ID_FILE), { recursive: true });
    const tmpFile = `${WORKER_ID_FILE}.tmp`;
    await fs.writeFile(tmpFile, id);
    await fs.rename(tmpFile, WORKER_ID_FILE);

    return id;
  }
}
```

**Step 3: Update CLI entry point** (1 min)

```typescript
// Add to packages/cli/src/index.ts
import { registerTaskCommand } from './commands/task.js';

// After registerStatusCommand(program);
registerTaskCommand(program);
```

**Step 4: Build and test** (30 sec)

```bash
pnpm -r build
node packages/cli/dist/index.js task claim
```

Expected: `No active workflow` (or task output if daemon running)

**Step 5: Commit** (30 sec)

```bash
git add packages/cli/src
git commit -m "feat(cli): add task claim and complete commands"
```

---

### Task 10: CLI - Compile Command

**Files:**
- Create: `packages/cli/src/commands/compile.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Write the compile command** (5 min)

```typescript
// packages/cli/src/commands/compile.ts
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function registerCompileCommand(program: Command): void {
  program
    .command('compile')
    .description('Compile workflow.ts to .hyh/ artifacts')
    .argument('<workflow>', 'Path to workflow.ts file')
    .option('-o, --output <dir>', 'Output directory', '.hyh')
    .action(async (workflowPath, options) => {
      const absolutePath = path.resolve(workflowPath);

      // Check file exists
      try {
        await fs.access(absolutePath);
      } catch {
        console.error(`File not found: ${absolutePath}`);
        process.exit(1);
      }

      console.log(`Compiling ${workflowPath}...`);

      try {
        // Dynamic import the workflow file (must be built .js or use tsx)
        const workflowUrl = pathToFileURL(absolutePath).href;
        const module = await import(workflowUrl);
        const workflow = module.default;

        if (!workflow || !workflow.name) {
          console.error('Workflow file must export default a compiled workflow');
          process.exit(1);
        }

        // Import compileToDir
        const { compileToDir } = await import('@hyh/dsl');

        const outputDir = path.resolve(options.output);
        await compileToDir(workflow, outputDir);

        console.log(`Compiled to ${outputDir}/`);
        console.log('  - workflow.json');
        console.log('  - hooks.json');
        console.log(`  - agents/ (${Object.keys(workflow.agents).length} prompts)`);
      } catch (error) {
        console.error('Compilation failed:', error);
        process.exit(1);
      }
    });
}
```

**Step 2: Update CLI entry point** (1 min)

```typescript
// Add to packages/cli/src/index.ts
import { registerCompileCommand } from './commands/compile.js';

// After other register calls
registerCompileCommand(program);
```

**Step 3: Build** (30 sec)

```bash
pnpm -r build
```

**Step 4: Commit** (30 sec)

```bash
git add packages/cli/src
git commit -m "feat(cli): add compile command for workflow files"
```

---

## Phase 3: Agent Management

### Task 11: Agent Process Wrapper

**Files:**
- Create: `packages/daemon/src/agents/process.ts`
- Create: `packages/daemon/src/agents/process.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/agents/process.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AgentProcess } from './process.js';

describe('AgentProcess', () => {
  it('creates agent with correct configuration', () => {
    const agent = new AgentProcess({
      agentId: 'worker-a1b2',
      model: 'sonnet',
      sessionId: 'test-session',
      systemPromptPath: '/tmp/prompt.md',
      tools: ['Read', 'Write', 'Edit'],
      cwd: '/tmp/test',
    });

    expect(agent.agentId).toBe('worker-a1b2');
    expect(agent.model).toBe('sonnet');
    expect(agent.isRunning).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/agents/process.test.ts
```

Expected: FAIL with `Cannot find module`

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/daemon/src/agents/process.ts
import { ChildProcess, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';

export interface AgentProcessConfig {
  agentId: string;
  model: 'haiku' | 'sonnet' | 'opus';
  sessionId: string;
  systemPromptPath: string;
  tools: string[];
  cwd: string;
}

export interface AgentEvent {
  type: 'tool_use' | 'tool_result' | 'message' | 'error' | 'exit';
  data?: unknown;
}

export class AgentProcess extends EventEmitter {
  readonly agentId: string;
  readonly model: string;
  readonly sessionId: string;
  private process: ChildProcess | null = null;
  private readonly config: AgentProcessConfig;

  constructor(config: AgentProcessConfig) {
    super();
    this.agentId = config.agentId;
    this.model = config.model;
    this.sessionId = config.sessionId;
    this.config = config;
  }

  get isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Agent already running');
    }

    const args = [
      '--session-id', this.sessionId,
      '--model', this.model,
      '--allowed-tools', this.config.tools.join(','),
      '--system-prompt', this.config.systemPromptPath,
      '--output-format', 'stream-json',
      '-p',
    ];

    this.process = spawn('claude', args, {
      cwd: this.config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.setupOutputParsing();
    this.setupErrorHandling();
  }

  async stop(): Promise<void> {
    if (!this.process) return;

    this.process.kill('SIGTERM');

    // Wait for graceful shutdown with timeout
    await Promise.race([
      new Promise<void>((resolve) => {
        this.process!.once('exit', () => resolve());
      }),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          this.process?.kill('SIGKILL');
          resolve();
        }, 5000);
      }),
    ]);

    this.process = null;
  }

  async injectPrompt(message: string): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Agent not running');
    }

    const injection = {
      type: 'user',
      message: {
        role: 'user',
        content: [{ type: 'text', text: message }],
      },
    };

    this.process.stdin.write(JSON.stringify(injection) + '\n');
  }

  private setupOutputParsing(): void {
    if (!this.process?.stdout) return;

    let buffer = '';
    this.process.stdout.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim()) {
          try {
            const event = JSON.parse(line);
            this.emit('event', { type: event.type, data: event });
          } catch {
            // Non-JSON output
            this.emit('event', { type: 'message', data: line });
          }
        }
      }
    });
  }

  private setupErrorHandling(): void {
    if (!this.process) return;

    this.process.stderr?.on('data', (data: Buffer) => {
      this.emit('error', new Error(data.toString()));
    });

    this.process.on('exit', (code) => {
      this.emit('event', { type: 'exit', data: { code } });
      this.process = null;
    });
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/agents/process.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/agents
git commit -m "feat(daemon): add AgentProcess wrapper for Claude CLI"
```

---

### Task 12: Agent Manager

**Files:**
- Create: `packages/daemon/src/agents/manager.ts`
- Create: `packages/daemon/src/agents/manager.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/agents/manager.test.ts
import { describe, it, expect } from 'vitest';
import { AgentManager } from './manager.js';

describe('AgentManager', () => {
  it('registers and retrieves agents', () => {
    const manager = new AgentManager('/tmp/test');

    expect(manager.getActiveAgents()).toHaveLength(0);
  });

  it('generates unique agent IDs', () => {
    const manager = new AgentManager('/tmp/test');

    const id1 = manager.generateAgentId('worker', 'task-1');
    const id2 = manager.generateAgentId('worker', 'task-2');

    expect(id1).toContain('worker');
    expect(id2).toContain('worker');
    expect(id1).not.toBe(id2);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/agents/manager.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (5 min)

```typescript
// packages/daemon/src/agents/manager.ts
import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { AgentProcess, AgentProcessConfig } from './process.js';

export interface SpawnSpec {
  agentType: string;
  taskId?: string;
  model: 'haiku' | 'sonnet' | 'opus';
  tools: string[];
  systemPromptPath: string;
}

export class AgentManager {
  private readonly worktreeRoot: string;
  private agents: Map<string, AgentProcess> = new Map();

  constructor(worktreeRoot: string) {
    this.worktreeRoot = worktreeRoot;
  }

  generateAgentId(agentType: string, taskId?: string): string {
    const suffix = crypto.randomBytes(4).toString('hex');
    return taskId
      ? `${agentType}-${taskId.slice(0, 4)}-${suffix}`
      : `${agentType}-${suffix}`;
  }

  async spawn(spec: SpawnSpec): Promise<AgentProcess> {
    const agentId = this.generateAgentId(spec.agentType, spec.taskId);
    const sessionId = crypto.randomUUID();

    const config: AgentProcessConfig = {
      agentId,
      model: spec.model,
      sessionId,
      systemPromptPath: spec.systemPromptPath,
      tools: spec.tools,
      cwd: this.worktreeRoot,
    };

    const agent = new AgentProcess(config);
    this.agents.set(agentId, agent);

    await agent.start();
    return agent;
  }

  async kill(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    await agent.stop();
    this.agents.delete(agentId);
  }

  async killAll(): Promise<void> {
    const killPromises = Array.from(this.agents.keys()).map((id) =>
      this.kill(id)
    );
    await Promise.all(killPromises);
  }

  get(agentId: string): AgentProcess | undefined {
    return this.agents.get(agentId);
  }

  getActiveAgents(): AgentProcess[] {
    return Array.from(this.agents.values()).filter((a) => a.isRunning);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/agents/manager.test.ts
```

Expected: PASS

**Step 5: Export from package** (1 min)

```typescript
// Add to packages/daemon/src/index.ts
export { AgentManager } from './agents/manager.js';
export { AgentProcess } from './agents/process.js';
export type { AgentProcessConfig, AgentEvent } from './agents/process.js';
export type { SpawnSpec } from './agents/manager.js';
```

**Step 6: Commit** (30 sec)

```bash
git add packages/daemon/src/agents packages/daemon/src/index.ts
git commit -m "feat(daemon): add AgentManager for process lifecycle"
```

---

### Task 13: Heartbeat Monitor

**Files:**
- Create: `packages/daemon/src/agents/heartbeat.ts`
- Create: `packages/daemon/src/agents/heartbeat.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/agents/heartbeat.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatMonitor } from './heartbeat.js';

describe('HeartbeatMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('tracks heartbeats and detects misses', () => {
    const monitor = new HeartbeatMonitor();

    monitor.register('agent-1', 30000); // 30s interval
    monitor.recordHeartbeat('agent-1');

    expect(monitor.check('agent-1').status).toBe('ok');

    // Advance time past interval
    vi.advanceTimersByTime(35000);

    const result = monitor.check('agent-1');
    expect(result.status).toBe('miss');
    expect(result.count).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/agents/heartbeat.test.ts
```

Expected: FAIL

**Step 3: Write minimal implementation** (4 min)

```typescript
// packages/daemon/src/agents/heartbeat.ts
export interface HeartbeatStatus {
  status: 'ok' | 'miss';
  count?: number;
}

interface AgentHeartbeat {
  interval: number;
  lastHeartbeat: number;
  missCount: number;
}

export class HeartbeatMonitor {
  private agents: Map<string, AgentHeartbeat> = new Map();

  register(agentId: string, interval: number): void {
    this.agents.set(agentId, {
      interval,
      lastHeartbeat: Date.now(),
      missCount: 0,
    });
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  recordHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
      agent.missCount = 0;
    }
  }

  check(agentId: string): HeartbeatStatus {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { status: 'ok' };
    }

    const elapsed = Date.now() - agent.lastHeartbeat;

    if (elapsed < agent.interval) {
      return { status: 'ok' };
    }

    agent.missCount += 1;
    return { status: 'miss', count: agent.missCount };
  }

  getOverdueAgents(): Array<{ agentId: string; missCount: number }> {
    const overdue: Array<{ agentId: string; missCount: number }> = [];

    for (const [agentId, agent] of this.agents) {
      const elapsed = Date.now() - agent.lastHeartbeat;
      if (elapsed >= agent.interval) {
        overdue.push({ agentId, missCount: agent.missCount + 1 });
      }
    }

    return overdue;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/agents/heartbeat.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/agents/heartbeat.ts packages/daemon/src/agents/heartbeat.test.ts
git commit -m "feat(daemon): add HeartbeatMonitor for agent liveness"
```

---

## Phase 4: Invariant Checking

### Task 14: Checker Interface and Chain

**Files:**
- Create: `packages/daemon/src/checkers/types.ts`
- Create: `packages/daemon/src/checkers/chain.ts`
- Create: `packages/daemon/src/checkers/chain.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/checkers/chain.test.ts
import { describe, it, expect } from 'vitest';
import { CheckerChain } from './chain.js';
import { Checker, Violation } from './types.js';

describe('CheckerChain', () => {
  it('runs checkers and returns first violation', () => {
    const passingChecker: Checker = {
      name: 'passing',
      appliesTo: () => true,
      check: () => null,
    };

    const failingChecker: Checker = {
      name: 'failing',
      appliesTo: () => true,
      check: () => ({
        type: 'test_violation',
        message: 'Test failed',
        agentId: 'agent-1',
      }),
    };

    const chain = new CheckerChain([passingChecker, failingChecker]);

    const event = { type: 'tool_use' as const, tool: 'Write', timestamp: Date.now() };
    const result = chain.check('agent-1', event, {});

    expect(result).not.toBeNull();
    expect(result!.type).toBe('test_violation');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/chain.test.ts
```

Expected: FAIL

**Step 3: Write types and chain** (5 min)

```typescript
// packages/daemon/src/checkers/types.ts
import { TrajectoryEvent } from '../types/trajectory.js';
import { WorkflowState } from '../types/state.js';
import { Correction } from '@hyh/dsl';

export interface Violation {
  type: string;
  message: string;
  agentId: string;
  event?: TrajectoryEvent;
  correction?: Correction;
}

export interface CheckContext {
  agentId: string;
  event: TrajectoryEvent;
  state: WorkflowState;
  trajectory?: TrajectoryEvent[];
}

export interface Checker {
  name: string;
  appliesTo(agentId: string, state: unknown): boolean;
  check(event: TrajectoryEvent, context: CheckContext): Violation | null;
}
```

```typescript
// packages/daemon/src/checkers/chain.ts
import { Checker, Violation, CheckContext } from './types.js';
import { TrajectoryEvent } from '../types/trajectory.js';

export class CheckerChain {
  private checkers: Checker[];

  constructor(checkers: Checker[] = []) {
    this.checkers = checkers;
  }

  addChecker(checker: Checker): void {
    this.checkers.push(checker);
  }

  check(
    agentId: string,
    event: TrajectoryEvent,
    state: unknown,
    trajectory?: TrajectoryEvent[]
  ): Violation | null {
    const context: CheckContext = {
      agentId,
      event,
      state: state as any,
      trajectory,
    };

    for (const checker of this.checkers) {
      if (checker.appliesTo(agentId, state)) {
        const violation = checker.check(event, context);
        if (violation) {
          return violation;
        }
      }
    }

    return null;
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/chain.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/checkers
git commit -m "feat(daemon): add CheckerChain for invariant checking"
```

---

### Task 15: TDD Checker Implementation

**Files:**
- Create: `packages/daemon/src/checkers/tdd.ts`
- Create: `packages/daemon/src/checkers/tdd.test.ts`

**Step 1: Write the failing test** (4 min)

```typescript
// packages/daemon/src/checkers/tdd.test.ts
import { describe, it, expect } from 'vitest';
import { TddChecker } from './tdd.js';
import { TrajectoryEvent } from '../types/trajectory.js';

describe('TddChecker', () => {
  const checker = new TddChecker({
    test: '**/*.test.ts',
    impl: 'src/**/*.ts',
    agentName: 'worker',
  });

  it('allows test file writes', () => {
    const event: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.test.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {} as any,
      trajectory: [],
    });

    expect(result).toBeNull();
  });

  it('blocks impl write before test', () => {
    const event: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {} as any,
      trajectory: [], // No prior test write
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('tdd');
  });

  it('allows impl after test write', () => {
    const testEvent: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now() - 1000,
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.test.ts',
    };

    const implEvent: TrajectoryEvent = {
      type: 'tool_use',
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.ts',
    };

    const result = checker.check(implEvent, {
      agentId: 'worker-1',
      event: implEvent,
      state: {} as any,
      trajectory: [testEvent],
    });

    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/tdd.test.ts
```

Expected: FAIL

**Step 3: Write TDD checker** (5 min)

```typescript
// packages/daemon/src/checkers/tdd.ts
import picomatch from 'picomatch';
import { Checker, Violation, CheckContext } from './types.js';
import { TrajectoryEvent } from '../types/trajectory.js';

export interface TddCheckerOptions {
  test: string;
  impl: string;
  agentName: string;
}

export class TddChecker implements Checker {
  name = 'tdd';
  private testMatcher: (path: string) => boolean;
  private implMatcher: (path: string) => boolean;
  private agentName: string;

  constructor(options: TddCheckerOptions) {
    this.testMatcher = picomatch(options.test);
    this.implMatcher = picomatch(options.impl);
    this.agentName = options.agentName;
  }

  appliesTo(agentId: string, state: unknown): boolean {
    return agentId.startsWith(this.agentName);
  }

  check(event: TrajectoryEvent, context: CheckContext): Violation | null {
    // Only check Write/Edit events
    if (event.type !== 'tool_use') return null;
    if (event.tool !== 'Write' && event.tool !== 'Edit') return null;
    if (!event.path) return null;

    // Test files are always allowed
    if (this.testMatcher(event.path)) {
      return null;
    }

    // Implementation files require prior test write
    if (this.implMatcher(event.path)) {
      const hasTestWrite = this.findTestWrite(event.path, context.trajectory || []);
      if (!hasTestWrite) {
        return {
          type: 'tdd',
          message: `Implementation file written before test: ${event.path}`,
          agentId: context.agentId,
          event,
          correction: {
            type: 'prompt',
            message: 'Delete implementation. Write failing tests first.',
          },
        };
      }
    }

    return null;
  }

  private findTestWrite(implPath: string, trajectory: TrajectoryEvent[]): boolean {
    // Convert impl path to test path (simple heuristic)
    const testPath = this.implToTestPath(implPath);

    return trajectory.some(
      (e) =>
        e.type === 'tool_use' &&
        (e.tool === 'Write' || e.tool === 'Edit') &&
        e.path &&
        this.testMatcher(e.path)
    );
  }

  private implToTestPath(implPath: string): string {
    // src/foo/bar.ts -> src/foo/bar.test.ts
    return implPath.replace(/\.ts$/, '.test.ts');
  }
}
```

**Step 4: Add picomatch dependency** (1 min)

```bash
cd packages/daemon && pnpm add picomatch && pnpm add -D @types/picomatch
```

**Step 5: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/tdd.test.ts
```

Expected: PASS

**Step 6: Commit** (30 sec)

```bash
git add packages/daemon
git commit -m "feat(daemon): add TddChecker for TDD enforcement"
```

---

### Task 16: File Scope Checker

**Files:**
- Create: `packages/daemon/src/checkers/file-scope.ts`
- Create: `packages/daemon/src/checkers/file-scope.test.ts`

**Step 1: Write the failing test** (3 min)

```typescript
// packages/daemon/src/checkers/file-scope.test.ts
import { describe, it, expect } from 'vitest';
import { FileScopeChecker } from './file-scope.js';

describe('FileScopeChecker', () => {
  it('allows writes to files in scope', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/auth/token.ts', 'tests/auth/token.test.ts'],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/auth/token.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {} as any,
    });

    expect(result).toBeNull();
  });

  it('blocks writes to files outside scope', () => {
    const checker = new FileScopeChecker({
      agentName: 'worker',
      allowedFiles: ['src/auth/token.ts'],
    });

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker-1',
      tool: 'Write',
      path: 'src/other/file.ts',
    };

    const result = checker.check(event, {
      agentId: 'worker-1',
      event,
      state: {} as any,
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('fileScope');
  });
});
```

**Step 2: Run test to verify it fails** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/file-scope.test.ts
```

Expected: FAIL

**Step 3: Write FileScopeChecker** (4 min)

```typescript
// packages/daemon/src/checkers/file-scope.ts
import { Checker, Violation, CheckContext } from './types.js';
import { TrajectoryEvent } from '../types/trajectory.js';

export interface FileScopeCheckerOptions {
  agentName: string;
  allowedFiles: string[];
}

export class FileScopeChecker implements Checker {
  name = 'fileScope';
  private agentName: string;
  private allowedFiles: Set<string>;

  constructor(options: FileScopeCheckerOptions) {
    this.agentName = options.agentName;
    this.allowedFiles = new Set(options.allowedFiles);
  }

  appliesTo(agentId: string, state: unknown): boolean {
    return agentId.startsWith(this.agentName);
  }

  check(event: TrajectoryEvent, context: CheckContext): Violation | null {
    if (event.type !== 'tool_use') return null;
    if (event.tool !== 'Write' && event.tool !== 'Edit') return null;
    if (!event.path) return null;

    if (!this.allowedFiles.has(event.path)) {
      return {
        type: 'fileScope',
        message: `File outside scope: ${event.path}`,
        agentId: context.agentId,
        event,
        correction: {
          type: 'block',
          message: `Cannot modify ${event.path} - not in task scope`,
        },
      };
    }

    return null;
  }

  updateAllowedFiles(files: string[]): void {
    this.allowedFiles = new Set(files);
  }
}
```

**Step 4: Run test to verify it passes** (30 sec)

```bash
pnpm test -- packages/daemon/src/checkers/file-scope.test.ts
```

Expected: PASS

**Step 5: Commit** (30 sec)

```bash
git add packages/daemon/src/checkers/file-scope.ts packages/daemon/src/checkers/file-scope.test.ts
git commit -m "feat(daemon): add FileScopeChecker for file access control"
```

---

## Parallel Group Summary

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1, 2, 3, 4, 5 | DSL compiler - sequential (each builds on previous) |
| Group 2 | 6, 7, 8, 9, 10 | CLI package - mostly sequential (structure first) |
| Group 3 | 11, 12, 13 | Agent management - can parallelize 12 and 13 after 11 |
| Group 4 | 14, 15, 16 | Checkers - 15 and 16 can run parallel after 14 |

---

## Remaining Tasks (Additional Phases)

### Phase 5: Integration (Tasks 17-22)

- **Task 17:** Integrate CheckerChain into Daemon
- **Task 18:** Correction Application System
- **Task 19:** Event Loop with Agent Monitoring
- **Task 20:** CLI `run` Command (start daemon + agents)
- **Task 21:** CLI `heartbeat` Command
- **Task 22:** End-to-End Integration Test

### Phase 6: Multi-Agent (Tasks 23-27)

- **Task 23:** Spawn Trigger System
- **Task 24:** Wave-Based Worktree Management
- **Task 25:** Task Dependency Scheduling
- **Task 26:** Gate Execution
- **Task 27:** Human Checkpoint Flow

### Phase 7: TUI (Deferred - Tasks 28-33)

- **Task 28:** Create TUI Package with Ink
- **Task 29:** IPC Client Hook
- **Task 30:** Overview Tab
- **Task 31:** Agents Tab
- **Task 32:** Tasks Tab
- **Task 33:** Keyboard Navigation

### Phase 8: Polish (Tasks 34-38)

- **Task 34:** Resumability (State Recovery)
- **Task 35:** Configuration System
- **Task 36:** Logging with pino
- **Task 37:** Error Codes and Handling
- **Task 38:** Documentation and Examples

---

### Final Task: Code Review

**Before merge, ensure:**
- [ ] All tests pass (`pnpm test`)
- [ ] TypeScript compiles (`pnpm typecheck`)
- [ ] No lint errors (`pnpm lint`)
- [ ] Documentation updated
- [ ] Example workflow file works end-to-end

---

*Plan generated 2024-12-31*
