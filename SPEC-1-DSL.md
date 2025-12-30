# SPEC-1: Workflow DSL Design

**Project**: hyh (Hold Your Horses) - Workflow Orchestration System  
**Version**: 2.0  
**Date**: December 2024  
**Status**: Draft  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Non-Goals](#3-goals--non-goals)
4. [Architecture Overview](#4-architecture-overview)
5. [DSL Design](#5-dsl-design)
6. [Core Primitives](#6-core-primitives)
7. [Invariant System](#7-invariant-system)
8. [Correction System](#8-correction-system)
9. [XML Output Format](#9-xml-output-format)
10. [Type Definitions](#10-type-definitions)

---

## 1. Executive Summary

### What

A TypeScript DSL that defines multi-agent workflows for Claude Code. The DSL compiles to runtime checkers, agent prompts, and XML task definitions. A rewritten `hyh` daemon in TypeScript executes workflows, enforces invariants, and provides an Ink-based TUI for observability.

### Why

Current Claude Code multi-agent workflows suffer from:
- **Implementation sprawl**: Hooks, skills, markdown files scattered without clear mapping to intent
- **No invariant enforcement**: Agents can deviate without correction
- **Poor observability**: No unified view of multi-agent progress
- **Difficult iteration**: Changes require touching many files

### Core Insight

The DSL should be **homoiconic**: the workflow definition IS the runtime checker. Like LISP, the structure encodes the constraints. The daemon interprets the DSL like a LISP interpreter evaluates S-expressions.

### Key Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Language | TypeScript | Method chaining, IDE autocomplete, type safety |
| DSL Style | Fluent/Builder (A1) | Code intelligence, intuitive chaining |
| Output Format | XML for tasks | Claude performs well with XML |
| Orchestration | Daemon + agent-as-orchestrator | hyh daemon manages state, orchestrator agent coordinates |
| TUI | Ink-based "cctop" | Claude Code aesthetic, gum-like feel, tabs |
| Spawning | Background processes | Simple, cross-platform |
| Worktree Strategy | Per-wave | Balance of isolation and simplicity |
| Violation Handling | Configurable per type | Flexibility for different severity levels |
| Pattern Detection | Leverage model intelligence | Avoid overly strict rules |

---

## 2. Problem Statement

### Current Pain Points

1. **Workflow Definition Drift**
   - Mental model (mermaid diagrams) diverges from implementation (hooks, .md files)
   - No single source of truth
   - Changes require updating multiple files

2. **Agent Abandonment**
   - Agents stop prematurely ("I have set up the basic structure...")
   - No enforcement of completion criteria
   - Context drift over long tasks

3. **No Invariant Checking**
   - TDD violations go undetected
   - File scope escapes unnoticed
   - Wrong tools used in wrong phases

4. **Poor Observability**
   - No unified view of multi-agent progress
   - Hard to debug stalled workflows
   - Trajectory spread across files

5. **Complex Iteration**
   - Testing workflows requires full execution
   - No simulation mode
   - No validation before runtime

### User Story

> As a developer using Claude Code with multi-agent workflows, I want to define my workflow in a single TypeScript file using a fluent DSL, so that:
> - The DSL compiles to all necessary artifacts (hooks, prompts, task definitions)
> - The runtime enforces my invariants and corrects deviations
> - I can observe progress in a unified TUI
> - I can iterate by editing one file and seeing changes immediately

---

## 3. Goals & Non-Goals

### Goals

1. **Single Source of Truth**: One `.ts` file defines the entire workflow
2. **Homoiconic DSL**: Structure compiles to runtime checkers
3. **Fluent API**: Method chaining with full IDE support
4. **Invariant Enforcement**: Detect and correct agent deviations
5. **Unified Observability**: Ink-based TUI showing all agents/tasks
6. **Resumability**: Workflows survive crashes and resume cleanly
7. **Claude Code Integration**: Works with existing Claude CLI
8. **Elegant Simplicity**: LISP-like - well thought through, dual-purpose

### Non-Goals

1. **Visual Editor**: No drag-and-drop workflow builder (future consideration)
2. **Language Agnostic**: TypeScript only (no Python DSL)
3. **Cloud Orchestration**: Local execution only
4. **Custom Models**: Claude models only (haiku, sonnet, opus)
5. **Backward Compatibility**: Clean break from Python hyh

---

## 4. Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DEVELOPMENT TIME                               │
│                                                                             │
│   workflow.ts ───compile───► .hyh/                                         │
│       │                        ├── workflow.json    (compiled workflow)    │
│       │                        ├── hooks.json       (claude code hooks)    │
│       │                        ├── agents/          (agent system prompts) │
│       │                        │     ├── orchestrator.md                   │
│       │                        │     ├── worker.md                         │
│       │                        │     └── verifier.md                       │
│       │                        └── schema.xml       (task template)        │
│       │                                                                     │
└───────┼─────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                RUNTIME                                      │
│                                                                             │
│   ┌─────────────┐         ┌──────────────────┐         ┌────────────────┐  │
│   │   cctop     │◄───────►│    hyh daemon    │◄───────►│  claude CLI    │  │
│   │   (TUI)     │   IPC   │  (state machine) │  stdio  │  (agents)      │  │
│   └─────────────┘         └──────────────────┘         └────────────────┘  │
│         │                         │                           │            │
│         │ renders                 │ enforces                  │ executes   │
│         ▼                         ▼                           ▼            │
│   ┌─────────────┐         ┌──────────────────┐         ┌────────────────┐  │
│   │  Agent list │         │  workflow.json   │         │  Agent prompts │  │
│   │  Task queue │         │  state.json      │         │  (from .hyh/)  │  │
│   │  Live logs  │         │  trajectory.jsonl│         │                │  │
│   └─────────────┘         └──────────────────┘         └────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User writes │     │  hyh compile │     │  hyh daemon  │     │  Claude CLI  │
│  workflow.ts │────►│  generates   │────►│  loads &     │────►│  executes    │
│              │     │  artifacts   │     │  enforces    │     │  agents      │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                │                     │
                                                │◄────────────────────┘
                                                │  reports actions
                                                │
                                          ┌─────▼─────┐
                                          │ Trajectory │
                                          │   .jsonl   │
                                          └───────────┘
```

### Process Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PROCESS HIERARCHY                                │
│                                                                             │
│   Terminal 1: cctop (TUI client)                                           │
│       │                                                                     │
│       │ IPC (Unix socket)                                                   │
│       ▼                                                                     │
│   Background: hyh daemon                                                    │
│       │                                                                     │
│       ├──► claude --session-id <uuid-1> (orchestrator)                     │
│       │                                                                     │
│       ├──► claude --session-id <uuid-2> (worker A)                         │
│       │                                                                     │
│       ├──► claude --session-id <uuid-3> (worker B)                         │
│       │                                                                     │
│       └──► claude --session-id <uuid-4> (verifier)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. DSL Design

### Design Principles

1. **Fluent Chaining**: Every method returns `this` for chaining
2. **Type Safety**: Invalid structures caught at compile time
3. **Declarative**: Describe what, not how
4. **Homoiconic**: Structure IS the checker
5. **Composable**: Reusable fragments
6. **Sensible Defaults**: Minimal boilerplate

### Complete Example

```typescript
import { workflow, queue, gate, agent, inv, correct, human, task } from '@hyh/dsl';

// === QUEUES ===

const tasks = queue('tasks')
  .ready(task => task.deps.allComplete)
  .timeout('10m')
  .examples(
    task('setup').files('src/setup.ts'),
    task('feature').depends('setup').files('src/feature.ts'),
  );

const verification = queue('verification');

// === GATES ===

const qualityGate = gate('quality')
  .requires(ctx => ctx.exec('npm test'))
  .requires(ctx => ctx.exec('npm run typecheck'))
  .requires(ctx => ctx.verifiedBy(verifier))
  .onFail(correct.retry({ max: 3 }))
  .onFailFinal(correct.escalate('human'));

// === AGENTS ===

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
    correct.prompt('No progress detected. Continue or report blockers.')
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

// === WORKFLOW ===

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

## 6. Core Primitives

### 6.1 Queue

Queues hold work items and define eligibility.

```typescript
interface QueueBuilder<T = Task> {
  // When a task is claimable
  ready(predicate: (task: T, state: State) => boolean): this;
  
  // Auto-release stalled tasks
  timeout(duration: Duration): this;
  
  // Completion condition
  done(predicate: (task: T) => boolean): this;
  
  // For testing/simulation
  examples(...tasks: TaskBuilder[]): this;
}
```

**Compilation**: `ready()` predicate becomes `canClaim()` checker.

**Example**:
```typescript
const tasks = queue('tasks')
  .ready(task => task.deps.allComplete)
  .timeout('10m');
```

### 6.2 Gate

Gates validate work before it proceeds.

```typescript
interface GateBuilder {
  // Automated checks
  requires(check: (ctx: Context) => Promise<boolean> | boolean): this;
  
  // Agent-based verification
  requires(check: (ctx: Context) => ctx.verifiedBy(agent: AgentBuilder)): this;
  
  // Failure handling (progressive)
  onFail(correction: Correction): this;
  onFailFinal(correction: Correction): this;
}
```

**Compilation**: `requires()` list becomes sequential checks with correction on failure.

**Example**:
```typescript
const qualityGate = gate('quality')
  .requires(ctx => ctx.exec('npm test'))
  .requires(ctx => ctx.verifiedBy(verifier))
  .onFail(correct.retry({ max: 3 }))
  .onFailFinal(correct.escalate('human'));
```

### 6.3 Agent

Agents define capabilities, constraints, and behavior.

```typescript
interface AgentBuilder {
  // Identity
  model(model: 'haiku' | 'sonnet' | 'opus'): this;
  role(role: string): this;
  
  // Capabilities
  tools(...tools: ToolSpec[]): this;
  readOnly(): this;  // Shorthand: no Write, Edit
  
  // Spawning
  spawns(agent: AgentBuilder): this;
  
  // Liveness
  heartbeat(interval: Duration): HeartbeatBuilder;
  
  // Constraints
  invariants(...invariants: Invariant[]): this;
  
  // Corrections
  onViolation(type: string, correction: Correction): this;
  onViolation(type: string, options: { after: number }, correction: Correction): this;
}

interface HeartbeatBuilder {
  onMiss(correction: Correction): this;
  onMiss(count: number, correction: Correction): this;
}
```

**Compilation**: Agent definition becomes:
1. System prompt (`.md` file)
2. Tool allowlist for Claude CLI
3. Invariant checkers
4. Violation handlers

**Example**:
```typescript
const worker = agent('worker')
  .model('sonnet')
  .role('implementation')
  .tools('Read', 'Write', 'Edit', 'Bash(npm:*)')
  .heartbeat('30s')
    .onMiss(correct.warn('Still working?'))
    .onMiss(3, correct.reassign())
  .invariants(inv.tdd({ test: '**/*.test.ts', impl: 'src/**/*.ts' }))
  .onViolation('tdd', correct.prompt('Write tests first.'));
```

### 6.4 Phase

Phases define workflow stages with transitions.

```typescript
interface PhaseBuilder {
  // Who executes
  agent(agent: AgentBuilder): this;
  
  // Work source
  queue(queue: QueueBuilder): this;
  
  // Tool constraints
  expects(...tools: ToolSpec[]): this;
  forbids(...tools: ToolSpec[]): this;
  
  // Prerequisites
  requires(...artifacts: string[]): this;
  
  // Outputs
  output(...artifacts: string[]): this;
  populates(queue: QueueBuilder): this;
  
  // Parallelism
  parallel(): this;
  parallel(count: number): this;
  
  // Validation
  gate(gate: GateBuilder): this;
  
  // Flow
  then(queue: QueueBuilder): this;
  checkpoint(checkpoint: Checkpoint): this;
  
  // Completion action
  onApprove(action: (ctx: Context) => void): this;
}
```

**Compilation**: Phases become:
1. State machine transitions
2. Spawn triggers
3. Tool checkers

**Transitions derived from structure**:
- Phase complete when: all `.output()` exist AND `.populates()` queue non-empty AND `.checkpoint()` passed
- Next phase when: `.requires()` artifacts exist AND previous phase complete

**Example**:
```typescript
.phase('implement')
  .queue(tasks)
  .agent(worker)
  .parallel()
  .gate(qualityGate)
  .then(verification)
```

### 6.5 Workflow

Top-level container.

```typescript
interface WorkflowBuilder {
  // Resumability
  resumable(): this;
  resumable(options: ResumeOptions): this;
  
  // Orchestration
  orchestrator(agent: AgentBuilder): this;
  
  // Phases
  phase(name: string): PhaseBuilder;
  
  // Build
  build(): CompiledWorkflow;
}

interface ResumeOptions {
  onResume?: 'continue' | 'restart';
}
```

**Example**:
```typescript
export default workflow('feature')
  .resumable()
  .orchestrator(orchestrator)
  .phase('explore')
    // ...
  .phase('implement')
    // ...
  .build();
```

### 6.6 Task

Task builder for examples/inline definition.

```typescript
interface TaskBuilder {
  files(...paths: string[]): this;
  depends(...taskIds: string[]): this;
  instructions(text: string): this;
  success(criteria: string): this;
}

function task(id: string): TaskBuilder;
```

**Example**:
```typescript
.examples(
  task('setup').files('src/setup.ts'),
  task('feature').depends('setup').files('src/feature.ts'),
)
```

### 6.7 Human Checkpoints

```typescript
interface HumanBuilder {
  approval(): Checkpoint;
  approval(question: string): Checkpoint;
  approval(options: ApprovalOptions): Checkpoint;
  
  choose(options: string[]): Choice;
}

interface ApprovalOptions {
  question?: string;
  timeout?: Duration;
  onTimeout?: 'abort' | 'continue' | 'escalate';
}
```

**Example**:
```typescript
.checkpoint(human.approval('Ready to merge?'))
```

---

## 7. Invariant System

### 7.1 Built-in Invariants

```typescript
const inv = {
  // TDD enforcement
  tdd(options: TddOptions): Invariant;
  
  // File scope restriction
  fileScope(getter: (ctx: Context) => string[]): Invariant;
  
  // No code modifications (for orchestrator)
  noCode(): Invariant;
  
  // Read-only agent
  readOnly(): Invariant;
  
  // Must produce output
  mustReport(format: string): Invariant;
  
  // Progress requirement
  mustProgress(timeout: Duration): Invariant;
};

interface TddOptions {
  test: GlobPattern;      // e.g., '**/*.test.ts'
  impl: GlobPattern;      // e.g., 'src/**/*.ts'
  order: ('test' | 'impl')[];  // Required sequence
  commit?: ('test' | 'impl')[]; // Commit points
}
```

### 7.2 Invariant Compilation

Each invariant compiles to a checker function:

**`inv.tdd()`**:
```typescript
function checkTdd(trajectory: Event[], options: TddOptions): Violation | null {
  const writes = trajectory.filter(e => e.tool === 'Write');
  
  for (const write of writes) {
    if (matches(write.path, options.impl) && !isTestFile(write.path)) {
      // Found impl write - verify test came first
      const testPath = toTestPath(write.path);
      const testWrite = writes.find(w => 
        w.path === testPath && w.timestamp < write.timestamp
      );
      if (!testWrite) {
        return { type: 'tdd', event: write, message: 'Impl before test' };
      }
    }
  }
  return null;
}
```

**`inv.fileScope()`**:
```typescript
function checkFileScope(event: Event, allowed: string[]): Violation | null {
  if (event.tool === 'Write' || event.tool === 'Edit') {
    if (!allowed.some(pattern => matches(event.path, pattern))) {
      return { type: 'fileScope', event, message: `File outside scope: ${event.path}` };
    }
  }
  return null;
}
```

**`inv.noCode()`**:
```typescript
function checkNoCode(event: Event): Violation | null {
  if (event.tool === 'Write' || event.tool === 'Edit') {
    if (isCodeFile(event.path)) {
      return { type: 'noCode', event, message: 'Code modification not allowed' };
    }
  }
  return null;
}
```

### 7.3 Phase Tool Checking

`.expects()` and `.forbids()` compile to:

```typescript
function checkPhaseTools(event: ToolEvent, phase: Phase): Violation | null {
  if (phase.forbidden.includes(event.tool)) {
    return { 
      type: 'forbidden_tool', 
      correction: { type: 'block', message: `${event.tool} not allowed in ${phase.name}` }
    };
  }
  if (phase.expected.length > 0 && !phase.expected.includes(event.tool)) {
    return {
      type: 'unexpected_tool',
      correction: { type: 'warn', message: `${event.tool} unusual in ${phase.name}` }
    };
  }
  return null;
}
```

**Default corrections**:
- `.forbids()` → `correct.block()` (hard stop)
- `.expects()` miss → `correct.warn()` (soft warning)

---

## 8. Correction System

### 8.1 Correction Types

```typescript
const correct = {
  // Inject prompt to agent
  prompt(message: string): Correction;
  
  // Log warning, continue
  warn(message: string): Correction;
  
  // Block action, agent must retry differently
  block(message?: string): Correction;
  
  // Kill and restart agent
  restart(): Correction;
  
  // Reassign task to another agent
  reassign(): Correction;
  
  // Retry with backoff
  retry(options: { max: number; backoff?: Duration }): Correction;
  
  // Escalate to parent or human
  escalate(to: 'orchestrator' | 'human'): Correction;
};
```

### 8.2 Correction Chaining

Corrections can be chained for progressive escalation:

```typescript
correct.prompt('Write tests first.')
  .then(correct.restart())
  .then(correct.escalate('orchestrator'))
```

**Compiled behavior**:
- Violation count 1: prompt
- Violation count 2: restart
- Violation count 3+: escalate

### 8.3 Count-Based Overrides

```typescript
.onViolation('tdd', correct.prompt('Write tests first.'))
.onViolation('tdd', { after: 2 }, correct.restart())
.onViolation('tdd', { after: 3 }, correct.escalate('orchestrator'))
```

### 8.4 Correction Execution

The daemon handles corrections:

```typescript
async function applyCorrection(agentId: string, correction: Correction): Promise<void> {
  switch (correction.type) {
    case 'prompt':
      // Inject message into agent's stdin
      agents[agentId].stdin.write(formatInjection(correction.message));
      break;
      
    case 'warn':
      // Log warning, no agent interaction
      logger.warn(agentId, correction.message);
      break;
      
    case 'block':
      // Send rejection response
      agents[agentId].stdin.write(formatRejection(correction.message));
      break;
      
    case 'restart':
      // Kill process, spawn fresh
      await agents[agentId].kill();
      await spawnAgent(agentId, state.agents[agentId].currentTask);
      break;
      
    case 'reassign':
      // Release task, mark for reclaim
      state.tasks[currentTask].status = 'pending';
      state.tasks[currentTask].claimedBy = null;
      break;
      
    case 'escalate':
      if (correction.to === 'human') {
        state.pendingHumanAction = { agentId, violation: correction.violation };
        // TUI shows alert
      } else {
        // Notify orchestrator agent
        const orch = agents['orchestrator'];
        orch.stdin.write(formatEscalation(agentId, correction.violation));
      }
      break;
  }
}
```

---

## 9. XML Output Format

### 9.1 Task XML Schema

The DSL compiles to XML for Claude consumption:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<plan goal="Implement user authentication feature">
  
  <dependencies>
    <dep from="session-manager" to="token-service"/>
    <dep from="auth-api" to="token-service,session-manager"/>
  </dependencies>
  
  <task id="token-service" model="sonnet" role="implementation">
    <description>JWT token generation and validation</description>
    
    <instructions>
      Implement the token service using TDD approach:
      1. Write failing tests in tests/auth/token.test.ts
      2. Run tests to confirm they fail (RED)
      3. Implement src/auth/token.ts to make tests pass (GREEN)
      4. Refactor while keeping tests green (REFACTOR)
      5. Commit after RED phase and after GREEN phase
    </instructions>
    
    <success>All tests in tests/auth/token.test.ts pass</success>
    
    <scope>
      <include>src/auth/token.ts</include>
      <include>tests/auth/token.test.ts</include>
      <exclude>src/api/*</exclude>
      <exclude>src/db/*</exclude>
    </scope>
    
    <tools>Read,Write,Edit,Bash(npm test:*),Bash(git:*),Bash(hyh:*)</tools>
    
    <constraints>
      - Do NOT modify files outside scope
      - Do NOT skip the failing test step
      - Commit after RED phase and after GREEN phase
    </constraints>
    
    <verification>
      <command>npm test -- tests/auth/token.test.ts</command>
      <command>npm run typecheck</command>
    </verification>
  </task>
  
  <task id="session-manager" model="sonnet" role="implementation">
    <!-- ... -->
  </task>
  
</plan>
```

### 9.2 Agent Prompt XML

Agent system prompts include XML-structured instructions:

```xml
<agent-config>
  <identity>
    <role>Implementation Engineer</role>
    <model>sonnet</model>
  </identity>
  
  <workflow>
    <claim>
      Run: hyh task claim --role implementation
      You will receive a task with instructions.
    </claim>
    
    <heartbeat interval="30s">
      Run: hyh heartbeat
      Signals you are still working. Missing 3 heartbeats = task reassignment.
    </heartbeat>
    
    <complete>
      Run: hyh task complete --id {task-id}
      Only after all success criteria are met.
    </complete>
  </workflow>
  
  <constraints>
    <invariant type="tdd">
      You MUST write failing tests before implementation.
      Test files: **/*.test.ts
      Impl files: src/**/*.ts
      Commit after: test, impl
    </invariant>
    
    <invariant type="fileScope">
      You may ONLY modify files listed in task scope.
      Violations will be blocked.
    </invariant>
  </constraints>
  
  <corrections>
    <on-violation type="tdd">
      You will receive: "Delete implementation. Write failing tests first."
      You must undo changes and restart with tests.
    </on-violation>
    
    <on-violation type="fileScope">
      Your action will be blocked.
      Choose a different file within scope.
    </on-violation>
  </corrections>
</agent-config>
```

---

## 10. Type Definitions

### 10.1 Core Types

```typescript
// Duration can be string or number
type Duration = `${number}${'s' | 'm' | 'h'}` | number;

// Glob pattern for file matching
type GlobPattern = string;

// Tool specification with optional constraints
type ToolSpec = string | { tool: string; pattern?: string };

// Task status
type TaskStatus = 'pending' | 'claimed' | 'running' | 'verifying' | 'complete' | 'failed';

// Agent model
type Model = 'haiku' | 'sonnet' | 'opus';
```

### 10.2 Context Type

Available in predicates and callbacks:

```typescript
interface Context {
  // Current state
  task: Task;
  agent: Agent;
  phase: Phase;
  workflow: Workflow;
  
  // History
  trajectory: Event[];
  
  // Actions
  exec(cmd: string): Promise<ExecResult>;
  verifiedBy(agent: AgentBuilder): Promise<boolean>;
  
  // Git operations
  git: {
    merge(): Promise<void>;
    commit(message: string): Promise<void>;
    push(): Promise<void>;
  };
  
  // Utilities
  uniqueId(): string;
  lastCheckpoint: Checkpoint;
}

interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  passed: boolean;  // exitCode === 0
}

interface Event {
  timestamp: number;
  agentId: string;
  type: 'tool_use' | 'tool_result' | 'message' | 'heartbeat';
  tool?: string;
  path?: string;
  args?: Record<string, unknown>;
}
```

### 10.3 Task Type

```typescript
interface Task {
  id: string;
  description: string;
  instructions: string;
  success: string;
  
  // Status
  status: TaskStatus;
  claimedBy: string | null;
  startedAt: number | null;
  completedAt: number | null;
  
  // Dependencies
  deps: {
    ids: string[];
    allComplete: boolean;
  };
  
  // Scope
  files: string[];
  
  // Metadata
  role?: string;
  model?: Model;
  priority?: number;
}
```

### 10.4 Compiled Workflow Type

```typescript
interface CompiledWorkflow {
  name: string;
  resumable: boolean;
  
  // Agents
  orchestrator: CompiledAgent;
  agents: Record<string, CompiledAgent>;
  
  // Phases
  phases: CompiledPhase[];
  
  // Queues
  queues: Record<string, CompiledQueue>;
  
  // Gates
  gates: Record<string, CompiledGate>;
  
  // Checkers (derived from structure)
  checkers: {
    canTransition(from: string, to: string, state: State): boolean;
    checkInvariant(agentId: string, event: Event, state: State): Violation | null;
    getCorrection(violation: Violation): Correction;
    shouldSpawn(state: State): Spawn[];
  };
}

interface CompiledAgent {
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
  systemPrompt: string;  // Generated markdown/XML
}

interface CompiledPhase {
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
  checkpoint?: CompiledCheckpoint;
}
```

---

## Next: SPEC-2

See **SPEC-2-RUNTIME.md** for:
- Daemon architecture
- TUI design (cctop)
- CLI commands
- State management
- Trajectory system
- Testing strategy
- Migration path
- Development phases
