# SPEC-2: Runtime & Implementation

**Project**: hyh (Hold Your Horses) - Workflow Orchestration System  
**Version**: 2.0  
**Date**: December 2024  
**Status**: Draft  

---

## Table of Contents

1. [Daemon Architecture](#1-daemon-architecture)
2. [State Management](#2-state-management)
3. [Trajectory System](#3-trajectory-system)
4. [Agent Lifecycle](#4-agent-lifecycle)
5. [Spawning & Process Management](#5-spawning--process-management)
6. [Worktree Strategy](#6-worktree-strategy)
7. [TUI Design (cctop)](#7-tui-design-cctop)
8. [CLI Commands](#8-cli-commands)
9. [Contextual Guidance](#9-contextual-guidance)
10. [Resumability](#10-resumability)
11. [Testing Strategy](#11-testing-strategy)
12. [Package Structure](#12-package-structure)
13. [Development Phases](#13-development-phases)
14. [Open Questions](#14-open-questions)

---

## 1. Daemon Architecture

### 1.1 Overview

The daemon is the runtime engine. It:
- Loads compiled workflow (`.hyh/workflow.json`)
- Manages agent processes (spawn, monitor, kill)
- Enforces invariants from DSL
- Applies corrections on violations
- Persists state for resumability
- Serves TUI clients via IPC

### 1.2 Core Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            HYH DAEMON                                   │
│                                                                         │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                  │
│   │  Workflow   │   │    State    │   │ Trajectory  │                  │
│   │   Engine    │   │   Manager   │   │   Logger    │                  │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘                  │
│          │                 │                 │                          │
│          └────────────┬────┴────────────────┘                          │
│                       │                                                 │
│                       ▼                                                 │
│   ┌───────────────────────────────────────────────────────────────┐    │
│   │                     Event Loop                                 │    │
│   │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │    │
│   │  │  IPC    │  │  Agent  │  │ Checker │  │Corrector│          │    │
│   │  │ Server  │  │ Manager │  │  Chain  │  │         │          │    │
│   │  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │    │
│   └───────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Module Breakdown

```typescript
// src/daemon/index.ts
export class Daemon {
  private workflow: CompiledWorkflow;
  private state: StateManager;
  private trajectory: TrajectoryLogger;
  private agents: AgentManager;
  private ipc: IPCServer;
  private checkers: CheckerChain;
  
  async start(workflowPath: string): Promise<void>;
  async stop(): Promise<void>;
  
  // Event handlers
  private onAgentAction(agentId: string, action: Action): Promise<Response>;
  private onIPCRequest(client: Client, request: Request): Promise<Response>;
  private onHeartbeatTimeout(agentId: string): Promise<void>;
}
```

### 1.4 Event Loop

```typescript
// Simplified event loop
async function eventLoop(daemon: Daemon) {
  while (daemon.running) {
    // 1. Check for IPC requests (TUI commands)
    const ipcRequests = await daemon.ipc.poll();
    for (const req of ipcRequests) {
      await daemon.handleIPCRequest(req);
    }
    
    // 2. Check for agent output (tool calls, completions)
    for (const agent of daemon.agents.active()) {
      const events = await agent.poll();
      for (const event of events) {
        await daemon.handleAgentEvent(agent.id, event);
      }
    }
    
    // 3. Check heartbeat timeouts
    for (const agent of daemon.agents.active()) {
      if (agent.heartbeatOverdue()) {
        await daemon.handleHeartbeatMiss(agent.id);
      }
    }
    
    // 4. Check spawn triggers
    const spawns = daemon.workflow.checkers.shouldSpawn(daemon.state.get());
    for (const spawn of spawns) {
      await daemon.spawnAgent(spawn);
    }
    
    // 5. Persist state periodically
    await daemon.state.flush();
    
    await sleep(10); // 10ms tick
  }
}
```

### 1.5 Agent Event Handling

```typescript
async function handleAgentEvent(agentId: string, event: AgentEvent): Promise<void> {
  // 1. Log to trajectory
  this.trajectory.append({
    timestamp: Date.now(),
    agentId,
    ...event,
  });
  
  // 2. Check invariants
  const violation = this.workflow.checkers.checkInvariant(
    agentId, 
    event, 
    this.state.get()
  );
  
  if (violation) {
    // 3. Get correction from DSL
    const correction = this.workflow.checkers.getCorrection(violation);
    
    // 4. Apply correction
    await this.applyCorrection(agentId, correction);
    
    // 5. Log correction
    this.trajectory.append({
      timestamp: Date.now(),
      agentId,
      type: 'correction',
      violation,
      correction,
    });
    
    return;
  }
  
  // 5. Update state if valid action
  await this.state.applyEvent(agentId, event);
  
  // 6. Generate guidance for agent's next action
  const guidance = this.generateGuidance(agentId);
  if (guidance.warnings.length > 0) {
    await this.agents.get(agentId).injectGuidance(guidance);
  }
}
```

---

## 2. State Management

### 2.1 State Structure

```typescript
interface WorkflowState {
  // Identity
  workflowId: string;
  workflowName: string;
  startedAt: number;
  
  // Current phase
  currentPhase: string;
  phaseHistory: PhaseTransition[];
  
  // Queues
  queues: Record<string, QueueState>;
  
  // Agents
  agents: Record<string, AgentState>;
  
  // Checkpoints
  checkpoints: Record<string, CheckpointState>;
  
  // Human actions pending
  pendingHumanActions: HumanAction[];
}

interface QueueState {
  tasks: Record<string, TaskState>;
}

interface TaskState {
  id: string;
  status: TaskStatus;
  claimedBy: string | null;
  claimedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
  attempts: number;
  lastError: string | null;
}

interface AgentState {
  id: string;
  type: string;  // 'orchestrator' | 'worker' | 'verifier'
  status: 'idle' | 'active' | 'stopped';
  currentTask: string | null;
  pid: number | null;
  sessionId: string | null;
  lastHeartbeat: number | null;
  violationCounts: Record<string, number>;
}
```

### 2.2 Atomic Persistence

```typescript
class StateManager {
  private state: WorkflowState;
  private stateFile: string;
  private dirty: boolean = false;
  
  async load(): Promise<WorkflowState> {
    if (await exists(this.stateFile)) {
      const content = await readFile(this.stateFile, 'utf-8');
      this.state = JSON.parse(content);
    } else {
      this.state = this.createInitialState();
    }
    return this.state;
  }
  
  async flush(): Promise<void> {
    if (!this.dirty) return;
    
    // Atomic write: tmp → fsync → rename
    const tmpFile = `${this.stateFile}.tmp`;
    await writeFile(tmpFile, JSON.stringify(this.state, null, 2));
    await fsync(tmpFile);
    await rename(tmpFile, this.stateFile);
    
    this.dirty = false;
  }
  
  update(mutator: (state: WorkflowState) => void): void {
    mutator(this.state);
    this.dirty = true;
  }
}
```

### 2.3 State Transitions

State changes derived from DSL:

```typescript
// Phase transitions
function canTransitionPhase(from: string, to: string, state: WorkflowState): boolean {
  const fromPhase = workflow.phases.find(p => p.name === from);
  const toPhase = workflow.phases.find(p => p.name === to);
  
  // Check order
  const fromIdx = workflow.phases.indexOf(fromPhase);
  const toIdx = workflow.phases.indexOf(toPhase);
  if (toIdx !== fromIdx + 1) return false;
  
  // Check outputs exist
  for (const output of fromPhase.outputs) {
    if (!fileExists(output)) return false;
  }
  
  // Check populated queues
  if (fromPhase.populates) {
    if (state.queues[fromPhase.populates].tasks.length === 0) return false;
  }
  
  // Check checkpoints
  for (const cp of fromPhase.checkpoints) {
    if (!state.checkpoints[cp.id]?.passed) return false;
  }
  
  return true;
}

// Task transitions
function canClaimTask(taskId: string, agentId: string, state: WorkflowState): boolean {
  const task = state.queues['tasks'].tasks[taskId];
  const agent = state.agents[agentId];
  const queue = workflow.queues['tasks'];
  
  // Check ready predicate
  if (!queue.ready(task, state)) return false;
  
  // Check not already claimed
  if (task.status !== 'pending') return false;
  
  // Check role match (if applicable)
  if (task.role && task.role !== agent.role) return false;
  
  return true;
}
```

---

## 3. Trajectory System

### 3.1 Event Types

```typescript
type TrajectoryEvent = 
  | ToolUseEvent
  | ToolResultEvent
  | MessageEvent
  | HeartbeatEvent
  | CorrectionEvent
  | SpawnEvent
  | PhaseTransitionEvent
  | TaskClaimEvent
  | TaskCompleteEvent;

interface ToolUseEvent {
  type: 'tool_use';
  timestamp: number;
  agentId: string;
  tool: string;
  args: Record<string, unknown>;
}

interface CorrectionEvent {
  type: 'correction';
  timestamp: number;
  agentId: string;
  violation: Violation;
  correction: Correction;
}

interface SpawnEvent {
  type: 'spawn';
  timestamp: number;
  agentId: string;
  agentType: string;
  taskId: string | null;
  pid: number;
  sessionId: string;
}
```

### 3.2 JSONL Format

```jsonl
{"type":"spawn","timestamp":1703980800000,"agentId":"orchestrator","agentType":"orchestrator","pid":12345,"sessionId":"uuid-1"}
{"type":"tool_use","timestamp":1703980801000,"agentId":"orchestrator","tool":"Read","args":{"path":"specs/spec.md"}}
{"type":"phase_transition","timestamp":1703980900000,"from":"explore","to":"plan"}
{"type":"spawn","timestamp":1703981000000,"agentId":"worker-a3f2","agentType":"worker","taskId":"token-service","pid":12346,"sessionId":"uuid-2"}
{"type":"tool_use","timestamp":1703981001000,"agentId":"worker-a3f2","tool":"Write","args":{"path":"src/auth/token.ts"}}
{"type":"correction","timestamp":1703981002000,"agentId":"worker-a3f2","violation":{"type":"tdd","message":"Impl before test"},"correction":{"type":"prompt","message":"Write tests first."}}
```

### 3.3 Efficient Tail Access

```typescript
class TrajectoryLogger {
  private file: string;
  
  append(event: TrajectoryEvent): void {
    const line = JSON.stringify(event) + '\n';
    appendFileSync(this.file, line);
  }
  
  tail(n: number): TrajectoryEvent[] {
    // Reverse seek for O(1) tail access
    const content = readFileTail(this.file, n * 1000); // Estimate bytes
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(-n).map(line => JSON.parse(line));
  }
  
  filterByAgent(agentId: string, limit: number): TrajectoryEvent[] {
    // Stream through file, collect matching events
    const events: TrajectoryEvent[] = [];
    for (const line of readLines(this.file, { reverse: true })) {
      const event = JSON.parse(line);
      if (event.agentId === agentId) {
        events.unshift(event);
        if (events.length >= limit) break;
      }
    }
    return events;
  }
}
```

---

## 4. Agent Lifecycle

### 4.1 Agent States

```
┌─────────┐
│ PENDING │ (defined in DSL, not yet spawned)
└────┬────┘
     │ spawn trigger
     ▼
┌─────────┐
│ STARTING│ (process spawning)
└────┬────┘
     │ first heartbeat
     ▼
┌─────────┐
│  ACTIVE │◄─────────────────────────────┐
└────┬────┘                              │
     │                                   │
     ├── task complete ──► IDLE ─────────┘
     │                                   │
     ├── violation ──► correction ───────┘
     │                                   
     ├── heartbeat miss ──► STALLED ────┐
     │                                   │
     └── workflow complete ──► STOPPED  │
                                        │
┌─────────┐                             │
│ STALLED │◄────────────────────────────┘
└────┬────┘
     │ 3 misses
     ▼
┌─────────┐
│  KILLED │ (reassign task, respawn)
└─────────┘
```

### 4.2 Spawning

```typescript
class AgentManager {
  private agents: Map<string, AgentProcess> = new Map();
  
  async spawn(spec: SpawnSpec): Promise<AgentProcess> {
    const { agentType, taskId, worktree } = spec;
    const agentDef = this.workflow.agents[agentType];
    
    // Generate unique IDs
    const agentId = taskId 
      ? `${agentType}-${taskId.slice(0, 4)}`
      : agentType;
    const sessionId = crypto.randomUUID();
    
    // Build Claude CLI args
    const args = [
      '--session-id', sessionId,
      '--model', agentDef.model,
      '--allowed-tools', agentDef.tools.join(','),
      '--system-prompt', this.generateSystemPrompt(agentDef, taskId),
      '-p', // Print mode for automation
    ];
    
    // Spawn process
    const proc = spawn('claude', args, {
      cwd: worktree || process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    const agent = new AgentProcess(agentId, proc, sessionId);
    this.agents.set(agentId, agent);
    
    // Start monitoring
    agent.stdout.on('data', (data) => this.onAgentOutput(agentId, data));
    agent.stderr.on('data', (data) => this.onAgentError(agentId, data));
    agent.on('exit', (code) => this.onAgentExit(agentId, code));
    
    // Log spawn event
    this.trajectory.append({
      type: 'spawn',
      timestamp: Date.now(),
      agentId,
      agentType,
      taskId,
      pid: proc.pid,
      sessionId,
    });
    
    return agent;
  }
  
  async kill(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    agent.process.kill('SIGTERM');
    
    // Wait for graceful shutdown
    await Promise.race([
      agent.waitForExit(),
      sleep(5000).then(() => agent.process.kill('SIGKILL')),
    ]);
    
    this.agents.delete(agentId);
  }
  
  async injectPrompt(agentId: string, message: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    // Write to stdin in Claude's expected format
    agent.stdin.write(`\n<system_injection>\n${message}\n</system_injection>\n`);
  }
}
```

### 4.3 Heartbeat Monitoring

```typescript
class HeartbeatMonitor {
  private lastHeartbeat: Map<string, number> = new Map();
  private missCount: Map<string, number> = new Map();
  
  recordHeartbeat(agentId: string): void {
    this.lastHeartbeat.set(agentId, Date.now());
    this.missCount.set(agentId, 0);
  }
  
  check(agentId: string, interval: number): HeartbeatStatus {
    const last = this.lastHeartbeat.get(agentId) || 0;
    const elapsed = Date.now() - last;
    
    if (elapsed < interval) {
      return { status: 'ok' };
    }
    
    const misses = (this.missCount.get(agentId) || 0) + 1;
    this.missCount.set(agentId, misses);
    
    return { status: 'miss', count: misses };
  }
}
```

---

## 5. Spawning & Process Management

### 5.1 Spawn Triggers

Derived from DSL structure:

```typescript
function checkSpawnTriggers(workflow: CompiledWorkflow, state: WorkflowState): SpawnSpec[] {
  const spawns: SpawnSpec[] = [];
  const currentPhase = workflow.phases.find(p => p.name === state.currentPhase);
  
  if (!currentPhase) return spawns;
  
  // Check if phase uses a queue
  if (currentPhase.queue) {
    const queue = state.queues[currentPhase.queue];
    const readyTasks = Object.values(queue.tasks).filter(t => 
      t.status === 'pending' && 
      workflow.queues[currentPhase.queue].ready(t, state)
    );
    
    // How many workers already active?
    const activeWorkers = Object.values(state.agents).filter(a => 
      a.type === currentPhase.agent && a.status === 'active'
    ).length;
    
    // How many to spawn?
    const maxParallel = currentPhase.parallel === true 
      ? readyTasks.length 
      : (currentPhase.parallel || 1);
    
    const toSpawn = Math.min(readyTasks.length, maxParallel - activeWorkers);
    
    for (let i = 0; i < toSpawn; i++) {
      spawns.push({
        agentType: currentPhase.agent,
        taskId: readyTasks[i].id,
        worktree: getWorktreeForTask(readyTasks[i], state),
      });
    }
  }
  
  return spawns;
}
```

### 5.2 Wave-Based Worktrees

```typescript
// Worktree strategy: per-wave
// Tasks in same dependency wave share a worktree
// New worktree when wave changes

interface Wave {
  id: number;
  tasks: string[];
  worktree: string;
}

function assignWorktrees(tasks: Task[], mainRepo: string): Wave[] {
  const waves: Wave[] = [];
  let currentWave: Wave | null = null;
  
  // Topological sort by dependencies
  const sorted = topologicalSort(tasks);
  
  for (const task of sorted) {
    const taskWaveId = getWaveId(task, tasks);
    
    if (!currentWave || currentWave.id !== taskWaveId) {
      // Create new wave/worktree
      const worktreePath = `${mainRepo}--wave-${taskWaveId}`;
      execSync(`git worktree add -b wave-${taskWaveId} ${worktreePath}`);
      
      currentWave = {
        id: taskWaveId,
        tasks: [],
        worktree: worktreePath,
      };
      waves.push(currentWave);
    }
    
    currentWave.tasks.push(task.id);
  }
  
  return waves;
}

function getWaveId(task: Task, allTasks: Task[]): number {
  if (task.deps.ids.length === 0) return 0;
  
  const depWaves = task.deps.ids.map(depId => {
    const depTask = allTasks.find(t => t.id === depId);
    return getWaveId(depTask, allTasks);
  });
  
  return Math.max(...depWaves) + 1;
}
```

### 5.3 Merge Strategy

When wave completes, merge to main feature branch:

```typescript
async function completeWave(wave: Wave, state: WorkflowState): Promise<void> {
  const mainWorktree = state.mainWorktree;
  
  // All tasks in wave must be complete
  const allComplete = wave.tasks.every(taskId => 
    state.queues['tasks'].tasks[taskId].status === 'complete'
  );
  
  if (!allComplete) return;
  
  // Merge wave branch into feature branch
  // Strategy determined by model intelligence - no hardcoded rule
  await exec(`git -C ${mainWorktree} merge wave-${wave.id} --no-ff -m "Merge wave ${wave.id}"`);
  
  // Clean up worktree
  await exec(`git worktree remove ${wave.worktree}`);
  await exec(`git branch -d wave-${wave.id}`);
}
```

---

## 6. Worktree Strategy

### 6.1 Directory Structure

```
~/projects/
├── my-project/                    # Main repo (orchestrator works here)
│   ├── .hyh/
│   │   ├── workflow.json
│   │   ├── state.json
│   │   └── trajectory.jsonl
│   └── src/
│
├── my-project--wave-0/            # Wave 0 worktree (setup tasks)
│   └── src/
│
├── my-project--wave-1/            # Wave 1 worktree (parallel tasks)
│   └── src/
│
└── my-project--wave-2/            # Wave 2 worktree (dependent tasks)
    └── src/
```

### 6.2 Worktree Commands

```typescript
const worktree = {
  async create(mainRepo: string, branch: string): Promise<string> {
    const worktreePath = `${mainRepo}--${branch}`;
    await exec(`git -C ${mainRepo} worktree add -b ${branch} ${worktreePath}`);
    return worktreePath;
  },
  
  async remove(worktreePath: string): Promise<void> {
    await exec(`git worktree remove ${worktreePath}`);
  },
  
  async list(mainRepo: string): Promise<WorktreeInfo[]> {
    const output = await exec(`git -C ${mainRepo} worktree list --porcelain`);
    return parseWorktreeList(output);
  },
};
```

---

## 7. TUI Design (cctop)

### 7.1 Design Goals

- **Claude Code aesthetic**: Similar visual language
- **gum-like feel**: Smooth, polished
- **Tab-based**: Multiple views without clutter
- **Real-time**: Live updates from daemon
- **Keyboard-driven**: Power user friendly

### 7.2 Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  hyh ─ my-project ─ feature-auth                    [?] help  [q] quit     │
├───────────────┬─────────────────────────────────────────────────────────────┤
│ [1] Overview  │ [2] Agents  │ [3] Tasks  │ [4] Logs  │ [5] Trajectory      │
├───────────────┴─────────────────────────────────────────────────────────────┤
│                                                                             │
│   PHASE: implement                                                          │
│   ════════════════════════════════════════════                             │
│   explore ✓ → plan ✓ → implement ● → verify ○ → complete ○                 │
│                                                                             │
│   PROGRESS                                                                  │
│   ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓                              │
│   ┃████████████████░░░░░░░░░░░░░░░░░░░░░░░░░┃ 8/20 tasks (40%)             │
│   ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛                              │
│                                                                             │
│   AGENTS                                                                    │
│   ┌──────────────────┬──────────┬─────────────┬────────────────────┐       │
│   │ Agent            │ Status   │ Task        │ Last Activity      │       │
│   ├──────────────────┼──────────┼─────────────┼────────────────────┤       │
│   │ orchestrator     │ ● idle   │ -           │ 2m ago             │       │
│   │ worker-a3f2      │ ● active │ T007        │ 3s ago             │       │
│   │ worker-b8c1      │ ● active │ T008        │ 1s ago             │       │
│   │ worker-d4e9      │ ○ done   │ T006        │ 5m ago             │       │
│   └──────────────────┴──────────┴─────────────┴────────────────────┘       │
│                                                                             │
│   RECENT                                                                    │
│   14:23:41  worker-a3f2  ✓ Tests passing: 4/4                              │
│   14:23:38  worker-b8c1  ⟳ Running: npm test session                       │
│   14:23:35  worker-a3f2  📝 Created: src/auth/token.ts                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Tab Views

**Tab 1: Overview** (shown above)
- Phase progress
- Task completion bar
- Active agents summary
- Recent events

**Tab 2: Agents**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ AGENTS                                                         [a] attach  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─ orchestrator ──────────────────────────────────────────────────────┐   │
│  │ Status: idle   Model: opus   Session: uuid-1234                     │   │
│  │ Tools: Read, Grep, Bash(hyh:*)                                      │   │
│  │ Violations: 0                                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─ worker-a3f2 ───────────────────────────────────────────────────────┐   │
│  │ Status: active   Model: sonnet   Session: uuid-5678                 │   │
│  │ Task: T007 - Implement token service                                │   │
│  │ Tools: Read, Write, Edit, Bash(npm:*), Bash(git:*), Bash(hyh:*)    │   │
│  │ Heartbeat: 3s ago   Violations: tdd(1)                              │   │
│  │ ─────────────────────────────────────────────────────────           │   │
│  │ Last tool: Write src/auth/token.test.ts                             │   │
│  │ Output: Created test file with 4 test cases                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tab 3: Tasks**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TASKS                                              [↑↓] navigate [f] filter │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Wave 0 ───────────────────────────────────────────────────────────────    │
│  ✓ T001  Setup project structure                              completed    │
│  ✓ T002  Initialize dependencies                              completed    │
│                                                                             │
│  Wave 1 ───────────────────────────────────────────────────────────────    │
│  ✓ T003  Create user model                                    completed    │
│  ✓ T004  Create session model                                 completed    │
│  ● T005  Implement token service           worker-a3f2        running      │
│  ● T006  Implement session manager         worker-b8c1        running      │
│  ○ T007  Implement password hashing                           ready        │
│                                                                             │
│  Wave 2 ───────────────────────────────────────────────────────────────    │
│  ◌ T008  Auth API endpoints                                   blocked      │
│  ◌ T009  Integration tests                                    blocked      │
│                                                                             │
│  Legend: ✓ complete  ● running  ○ ready  ◌ blocked                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tab 4: Logs**
- Real-time log stream
- Filter by agent
- Search

**Tab 5: Trajectory**
- Full event history
- JSON view
- Export option

### 7.4 Ink Components

```typescript
// src/tui/App.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { Overview } from './tabs/Overview';
import { Agents } from './tabs/Agents';
import { Tasks } from './tabs/Tasks';
import { Logs } from './tabs/Logs';
import { Trajectory } from './tabs/Trajectory';

const TABS = ['Overview', 'Agents', 'Tasks', 'Logs', 'Trajectory'];

export function App({ daemon }: { daemon: DaemonClient }) {
  const [activeTab, setActiveTab] = useState(0);
  const [state, setState] = useState<WorkflowState | null>(null);
  
  // Subscribe to daemon updates
  useEffect(() => {
    return daemon.subscribe(setState);
  }, [daemon]);
  
  useInput((input, key) => {
    if (input >= '1' && input <= '5') {
      setActiveTab(parseInt(input) - 1);
    }
    if (input === 'q') {
      process.exit(0);
    }
  });
  
  const TabComponent = [Overview, Agents, Tasks, Logs, Trajectory][activeTab];
  
  return (
    <Box flexDirection="column" height="100%">
      <Header project={state?.workflowName} />
      <TabBar tabs={TABS} active={activeTab} />
      <Box flexGrow={1}>
        <TabComponent state={state} daemon={daemon} />
      </Box>
    </Box>
  );
}
```

### 7.5 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `1-5` | Switch tabs |
| `q` | Quit |
| `?` | Help |
| `a` | Attach to agent (in Agents tab) |
| `↑↓` | Navigate lists |
| `f` | Filter |
| `/` | Search |
| `r` | Refresh |
| `p` | Pause/resume agent |

---

## 8. CLI Commands

### 8.1 Command Overview

```bash
# Workflow authoring
hyh init                      # Create workflow.ts template
hyh validate <workflow.ts>    # Check DSL structure
hyh compile <workflow.ts>     # Generate .hyh/ artifacts

# Execution
hyh run <workflow.ts>         # Execute workflow
hyh dev <workflow.ts>         # Watch mode + TUI
hyh simulate <workflow.ts>    # Dry run with examples

# Monitoring
hyh status                    # TUI dashboard (cctop)
hyh logs [--agent <id>]       # Stream logs

# Task management (called by agents)
hyh task claim [--role <role>]
hyh task complete --id <id>
hyh heartbeat

# State management
hyh state                     # Print current state
hyh state reset               # Clear state
hyh resume                    # Resume from saved state
```

### 8.2 Command Implementations

```typescript
// src/cli/commands/run.ts
export async function run(workflowPath: string, options: RunOptions): Promise<void> {
  // 1. Compile workflow
  const compiled = await compile(workflowPath);
  
  // 2. Write artifacts to .hyh/
  await writeArtifacts(compiled);
  
  // 3. Start daemon
  const daemon = new Daemon();
  await daemon.start('.hyh/workflow.json');
  
  // 4. Start TUI if interactive
  if (process.stdout.isTTY) {
    await startTUI(daemon);
  } else {
    // Headless mode - just wait for completion
    await daemon.waitForCompletion();
  }
}

// src/cli/commands/task.ts
export async function taskClaim(options: ClaimOptions): Promise<void> {
  const client = await connectToDaemon();
  
  const result = await client.request({
    type: 'task_claim',
    role: options.role,
    workerId: getWorkerId(),
  });
  
  if (result.task) {
    // Output task as JSON for agent consumption
    console.log(JSON.stringify(result.task, null, 2));
    
    // Also output guidance
    if (result.guidance) {
      console.log('\n--- GUIDANCE ---');
      console.log(result.guidance);
    }
  } else {
    console.log('No tasks available');
    process.exit(1);
  }
}
```

---

## 9. Contextual Guidance

### 9.1 Guidance Generation

When an agent claims a task, the daemon generates contextual guidance based on trajectory analysis:

```typescript
interface Guidance {
  context: string;      // Task instructions
  steps: string[];      // Suggested steps
  constraints: string[];// From DSL
  warnings: string[];   // From trajectory analysis
}

function generateGuidance(
  task: Task, 
  agent: AgentDef,
  trajectory: TrajectoryEvent[],
  state: WorkflowState
): Guidance {
  const guidance: Guidance = {
    context: task.instructions,
    steps: agent.steps || [],
    constraints: agent.constraints || [],
    warnings: [],
  };
  
  // Check for previous failures on this task
  const previousAttempts = trajectory.filter(e => 
    e.type === 'task_claim' && e.taskId === task.id
  );
  
  if (previousAttempts.length > 0) {
    const lastFailure = findLastFailure(task.id, trajectory);
    if (lastFailure) {
      guidance.warnings.push(
        `⚠️ Previous attempt failed: ${lastFailure.reason}. Avoid: ${lastFailure.avoidance}`
      );
    }
  }
  
  // Check for common violations in this phase
  const phaseViolations = trajectory.filter(e =>
    e.type === 'correction' && 
    state.agents[e.agentId]?.type === agent.name
  );
  
  if (phaseViolations.length > 0) {
    const patterns = detectPatterns(phaseViolations);
    for (const pattern of patterns.slice(0, 3)) {
      guidance.warnings.push(`⚠️ Common issue: ${pattern.description}`);
    }
  }
  
  return guidance;
}
```

### 9.2 Pattern Detection

Leverage model intelligence rather than strict rules:

```typescript
// Pattern detection is intentionally lightweight
// The model's intelligence handles edge cases

function detectPatterns(violations: CorrectionEvent[]): Pattern[] {
  const patterns: Pattern[] = [];
  
  // Count violation types
  const counts = violations.reduce((acc, v) => {
    acc[v.violation.type] = (acc[v.violation.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Surface frequent violations
  for (const [type, count] of Object.entries(counts)) {
    if (count >= 2) {
      patterns.push({
        type,
        count,
        description: getViolationDescription(type),
      });
    }
  }
  
  return patterns.sort((a, b) => b.count - a.count);
}
```

---

## 10. Resumability

### 10.1 Checkpoint Strategy

State is persisted after every significant event:
- Phase transitions
- Task claims/completions
- Agent spawns/exits
- Corrections applied

### 10.2 Resume Flow

```typescript
async function resume(workflowPath: string): Promise<void> {
  // 1. Load compiled workflow
  const compiled = await loadWorkflow('.hyh/workflow.json');
  
  // 2. Load saved state
  const state = await loadState('.hyh/state.json');
  
  if (!state) {
    throw new Error('No state to resume from');
  }
  
  // 3. Validate state against workflow
  validateStateConsistency(compiled, state);
  
  // 4. Start daemon with existing state
  const daemon = new Daemon();
  await daemon.start('.hyh/workflow.json', { resumeFrom: state });
  
  // 5. Respawn any agents that were active
  for (const [agentId, agentState] of Object.entries(state.agents)) {
    if (agentState.status === 'active') {
      await daemon.spawnAgent({
        agentType: agentState.type,
        taskId: agentState.currentTask,
        sessionId: agentState.sessionId, // Resume Claude session
      });
    }
  }
  
  // 6. Start TUI
  await startTUI(daemon);
}
```

### 10.3 Session Continuity

Use Claude's `--resume` flag for agent session continuity:

```typescript
async function spawnWithResume(spec: SpawnSpec, existingSessionId?: string): Promise<void> {
  const args = existingSessionId
    ? ['--resume', existingSessionId]
    : ['--session-id', crypto.randomUUID()];
  
  // ... rest of spawn logic
}
```

---

## 11. Testing Strategy

### 11.1 DSL Tests

```typescript
// Test that DSL compiles correctly
describe('DSL Compilation', () => {
  test('workflow compiles to valid JSON', () => {
    const wf = workflow('test')
      .phase('explore')
        .expects('Read')
      .build();
    
    expect(wf.phases).toHaveLength(1);
    expect(wf.phases[0].expects).toContain('Read');
  });
  
  test('rules compile to checker functions', () => {
    const a = agent('worker')
      .rules(rule => [rule.tdd({ test: '*.test.ts', impl: 'src/*.ts' })])
      .build();

    const checker = a.invariants[0].checker;
    expect(typeof checker).toBe('function');
  });
});
```

### 11.2 Checker Tests

```typescript
// Test that checkers detect violations correctly
describe('TDD Checker', () => {
  const checker = compileTddChecker({ test: '*.test.ts', impl: 'src/*.ts' });
  
  test('allows test before impl', () => {
    const trajectory = [
      { tool: 'Write', path: 'foo.test.ts', timestamp: 1 },
      { tool: 'Write', path: 'src/foo.ts', timestamp: 2 },
    ];
    expect(checker(trajectory)).toBeNull();
  });
  
  test('detects impl before test', () => {
    const trajectory = [
      { tool: 'Write', path: 'src/foo.ts', timestamp: 1 },
    ];
    expect(checker(trajectory)).toEqual({
      type: 'tdd',
      message: expect.stringContaining('before test'),
    });
  });
});
```

### 11.3 Simulation Tests

```typescript
// Test full workflow execution with mocked Claude
describe('Workflow Simulation', () => {
  test('happy path completes all phases', async () => {
    const wf = loadWorkflow('./fixtures/simple-workflow.ts');
    const sim = new Simulator(wf, {
      mockAgent: (agent, task) => {
        // Simulate agent completing task successfully
        return { success: true, outputs: ['file.ts'] };
      },
    });
    
    const result = await sim.run();
    
    expect(result.finalPhase).toBe('complete');
    expect(result.violations).toHaveLength(0);
  });
  
  test('TDD violation triggers correction', async () => {
    const wf = loadWorkflow('./fixtures/tdd-workflow.ts');
    const sim = new Simulator(wf, {
      mockAgent: (agent, task) => {
        // Simulate agent writing impl before test
        return {
          toolCalls: [
            { tool: 'Write', path: 'src/foo.ts' },  // Violation!
          ],
        };
      },
    });
    
    const result = await sim.run();
    
    expect(result.corrections).toContainEqual(
      expect.objectContaining({ type: 'tdd' })
    );
  });
});
```

### 11.4 Integration Tests

```typescript
// Test actual daemon with real Claude (slow, CI only)
describe('Integration', () => {
  test('simple workflow executes end-to-end', async () => {
    const daemon = new Daemon();
    await daemon.start('./fixtures/simple-workflow.json');
    
    // Wait for completion (with timeout)
    const result = await Promise.race([
      daemon.waitForCompletion(),
      sleep(300000).then(() => { throw new Error('Timeout'); }),
    ]);
    
    expect(result.success).toBe(true);
    expect(result.tasksCompleted).toBeGreaterThan(0);
  }, 300000);
});
```

---

## 12. Package Structure

### 12.1 Monorepo Layout

```
hyh/
├── packages/
│   ├── dsl/                    # @hyh/dsl
│   │   ├── src/
│   │   │   ├── builders/       # Workflow, Agent, Queue, etc.
│   │   │   ├── invariants/     # Built-in invariants
│   │   │   ├── corrections/    # Correction types
│   │   │   ├── compiler/       # DSL → JSON/XML
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── daemon/                 # @hyh/daemon
│   │   ├── src/
│   │   │   ├── core/           # Daemon, EventLoop
│   │   │   ├── state/          # StateManager
│   │   │   ├── agents/         # AgentManager, spawning
│   │   │   ├── checkers/       # Invariant checking
│   │   │   ├── ipc/            # IPC server
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── tui/                    # @hyh/tui
│   │   ├── src/
│   │   │   ├── components/     # Ink components
│   │   │   ├── tabs/           # Tab views
│   │   │   ├── hooks/          # React hooks
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                    # hyh (main CLI)
│       ├── src/
│       │   ├── commands/       # CLI commands
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                # Workspace root
├── pnpm-workspace.yaml
└── turbo.json
```

### 12.2 Package Dependencies

```
┌─────────┐     ┌─────────┐     ┌─────────┐
│   cli   │────►│  daemon │────►│   dsl   │
└─────────┘     └─────────┘     └─────────┘
     │               │
     │               │
     ▼               ▼
┌─────────┐     ┌─────────┐
│   tui   │────►│ daemon  │
└─────────┘     └─────────┘
```

---

## 13. Development Phases

### Phase 1: Foundation (2-3 weeks)

**Goal**: Core DSL and basic daemon

- [ ] DSL builders (workflow, agent, queue, gate, phase)
- [ ] DSL compiler (TS → JSON)
- [ ] Basic daemon (state management, no agents)
- [ ] CLI scaffolding (init, compile, validate)
- [ ] Unit tests for DSL and checkers

**Deliverable**: Can compile workflow.ts to .hyh/workflow.json

### Phase 2: Agent Management (2-3 weeks)

**Goal**: Spawn and monitor Claude agents

- [ ] Agent spawning (claude CLI integration)
- [ ] Heartbeat monitoring
- [ ] Basic invariant checking
- [ ] Correction application
- [ ] Trajectory logging

**Deliverable**: Can run simple workflow with single agent

### Phase 3: Multi-Agent (2 weeks)

**Goal**: Parallel agents and queues

- [ ] Queue implementation
- [ ] Spawn triggers from DSL
- [ ] Worktree management
- [ ] Wave-based parallelism
- [ ] Task claiming/completion

**Deliverable**: Can run workflow with parallel workers

### Phase 4: TUI (2 weeks)

**Goal**: Full cctop experience

- [ ] Ink app structure
- [ ] All 5 tabs
- [ ] Real-time updates
- [ ] Keyboard navigation
- [ ] Agent attachment

**Deliverable**: Beautiful, functional TUI

### Phase 5: Polish (1-2 weeks)

**Goal**: Production ready

- [ ] Resumability
- [ ] Error handling
- [ ] Documentation
- [ ] Integration tests
- [ ] Performance optimization

**Deliverable**: v1.0 release

---

## 14. Open Questions

### 14.1 Resolved

| Question | Resolution |
|----------|------------|
| TypeScript vs Python | TypeScript (fluent API, IDE support) |
| DSL style | Fluent/Builder (method chaining) |
| Output format | XML for tasks (Claude-friendly) |
| Spawning mechanism | Background processes |
| Worktree strategy | Per-wave |
| Violation handling | Configurable per type via DSL |
| Package naming | @hyh/* monorepo |

### 14.2 Open

| Question | Options | Notes |
|----------|---------|-------|
| Claude session management | `--session-id` vs `--resume` | Need to test both |
| IPC protocol | Unix socket vs HTTP | Unix socket simpler |
| XML schema validation | Strict vs lenient | Start lenient |
| Agent attachment | tmux vs custom | Custom may be better |
| CI/CD testing | Mock Claude vs real | Probably both tiers |

---

## Appendix A: Example Workflow

Complete example for reference:

```typescript
// workflow.ts
import { workflow, queue, gate, agent, inv, correct, human, task } from '@hyh/dsl';

// Queues
const tasks = queue('tasks')
  .ready(task => task.deps.allComplete)
  .timeout('10m')
  .examples(
    task('setup').files('src/setup.ts'),
    task('feature').depends('setup').files('src/feature.ts'),
  );

const verification = queue('verification');

// Gates
const qualityGate = gate('quality')
  .requires(ctx => ctx.exec('npm test'))
  .requires(ctx => ctx.exec('npm run typecheck'))
  .requires(ctx => ctx.verifiedBy(verifier))
  .onFail(correct.retry({ max: 3 }))
  .onFailFinal(correct.escalate('human'));

// Agents
const orchestrator = agent('orchestrator')
  .model('opus')
  .role('coordinator')
  .tools('Read', 'Grep', 'Bash(hyh:*)')
  .spawns(worker)
  .invariants(
    inv.noCode(),
    inv.mustProgress('10m'),
  )
  .onViolation('noCode', correct.block())
  .onViolation('mustProgress', 
    correct.prompt('No progress. Continue or report blockers.')
      .then(correct.escalate('human'))
  );

const worker = agent('worker')
  .model('sonnet')
  .role('implementation')
  .tools('Read', 'Write', 'Edit', 'Bash(npm:*)', 'Bash(git:*)', 'Bash(hyh:*)')
  .heartbeat('30s')
    .onMiss(correct.warn('Continue working or ask for help.'))
    .onMiss(3, correct.reassign())
  .invariants(
    inv.tdd({
      test: '**/*.test.ts',
      impl: 'src/**/*.ts',
      order: ['test', 'impl'],
      commit: ['test', 'impl'],
    }),
    inv.fileScope(ctx => ctx.task.files),
  )
  .onViolation('tdd', 
    correct.prompt('Delete implementation. Write failing tests first.')
      .then(correct.restart())
      .then(correct.escalate('orchestrator'))
  )
  .onViolation('fileScope', correct.block());

const verifier = agent('verifier')
  .model('sonnet')
  .role('reviewer')
  .tools('Read', 'Bash(npm:*)')
  .readOnly()
  .invariants(
    inv.mustReport('verification-result'),
  );

// Workflow
export default workflow('feature')
  .resumable()
  .orchestrator(orchestrator)
  
  .phase('explore')
    .agent(orchestrator)
    .expects('Read', 'Grep', 'Glob')
    .forbids('Write', 'Edit')
    .output('architecture.md')
  
  .phase('plan')
    .agent(orchestrator)
    .requires('architecture.md')
    .output('plan.md', 'tasks.md')
    .populates(tasks)
    .checkpoint(human.approval())
  
  .phase('implement')
    .queue(tasks)
    .agent(worker)
    .parallel()
    .gate(qualityGate)
    .then(verification)
  
  .phase('verify')
    .queue(verification)
    .agent(verifier)
    .parallel(3)
  
  .phase('complete')
    .agent(orchestrator)
    .checkpoint(human.approval('Ready to merge?'))
    .onApprove(ctx => ctx.git.merge())
  
  .build();
```

---

## Appendix B: Generated Files

### .hyh/workflow.json (excerpt)

```json
{
  "name": "feature",
  "resumable": true,
  "orchestrator": "orchestrator",
  "agents": {
    "orchestrator": {
      "name": "orchestrator",
      "model": "opus",
      "role": "coordinator",
      "tools": ["Read", "Grep", "Bash(hyh:*)"],
      "spawns": ["worker"],
      "invariants": [
        { "type": "noCode" },
        { "type": "mustProgress", "timeout": 600000 }
      ]
    },
    "worker": {
      "name": "worker",
      "model": "sonnet",
      "role": "implementation",
      "tools": ["Read", "Write", "Edit", "Bash(npm:*)", "Bash(git:*)", "Bash(hyh:*)"],
      "invariants": [
        { "type": "tdd", "test": "**/*.test.ts", "impl": "src/**/*.ts" },
        { "type": "fileScope", "source": "task.files" }
      ]
    }
  },
  "phases": [
    {
      "name": "explore",
      "agent": "orchestrator",
      "expects": ["Read", "Grep", "Glob"],
      "forbids": ["Write", "Edit"],
      "outputs": ["architecture.md"]
    },
    {
      "name": "implement",
      "queue": "tasks",
      "agent": "worker",
      "parallel": true,
      "gate": "quality",
      "then": "verification"
    }
  ],
  "queues": {
    "tasks": {
      "ready": "task.deps.allComplete",
      "timeout": 600000
    }
  }
}
```

### .hyh/agents/worker.md

```markdown
# Worker Agent

## Identity
- **Role**: Implementation Engineer  
- **Model**: sonnet

## Workflow

### Getting Work
1. Run: `hyh task claim --role implementation`
2. You will receive a task with instructions
3. Follow the instructions precisely

### Heartbeat
Run `hyh heartbeat` every 30 seconds to signal you're working.
Missing 3 heartbeats will result in task reassignment.

### Completing Work
Run: `hyh task complete --id <task-id>`
Only after all success criteria are met.

## Constraints

### TDD (Test-Driven Development)
You MUST write failing tests before implementation.
- Test files: `**/*.test.ts`
- Impl files: `src/**/*.ts`
- Commit after writing tests (RED)
- Commit after implementation passes (GREEN)

**Violation Response**: You will be asked to delete implementation and start with tests.

### File Scope
You may ONLY modify files listed in your task's scope.

**Violation Response**: Your action will be blocked.

## Tools Available
- Read
- Write
- Edit
- Bash(npm:*)
- Bash(git:*)
- Bash(hyh:*)
```

---

*End of SPEC-2*
