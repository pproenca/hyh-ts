# SPEC-3: Validation, Addendum & Implementation Guide

**Purpose**: Comprehensive gap analysis, missing details, and implementation guide  
**Date**: December 2024  
**Status**: Final Review

---

## Table of Contents

1. [Validation Summary](#1-validation-summary)
2. [Mermaid Coverage Audit](#2-mermaid-coverage-audit)
3. [DSL Package Gaps](#3-dsl-package-gaps)
4. [Daemon Gaps](#4-daemon-gaps)
5. [TUI Gaps](#5-tui-gaps)
6. [CLI Gaps](#6-cli-gaps)
7. [Cross-Cutting Concerns](#7-cross-cutting-concerns)
8. [Integration Protocols](#8-integration-protocols)
9. [Edge Cases & Error Handling](#9-edge-cases--error-handling)
10. [Missing: Configuration](#10-missing-configuration)
11. [Missing: Claude CLI Integration](#11-missing-claude-cli-integration)
12. [Missing: Metrics & Telemetry](#12-missing-metrics--telemetry)
13. [Missing: Claude Code Hooks Generation](#13-missing-claude-code-hooks-generation)
14. [Missing: Task Packet Format](#14-missing-task-packet-format)
15. [Missing: Anti-Abandonment Patterns](#15-missing-anti-abandonment-patterns)
16. [Missing: Context Budget Management](#16-missing-context-budget-management)
17. [Missing: Artifact System](#17-missing-artifact-system)
18. [Missing: Re-injection Pattern](#18-missing-re-injection-pattern)
19. [Missing: Scaling Rules](#19-missing-scaling-rules)
20. [Implementation Checklist](#20-implementation-checklist)

---

## 1. Validation Summary

### Coverage Assessment

| Component | Spec Coverage | Gaps Found | Status |
|-----------|---------------|------------|--------|
| DSL Primitives | 95% | Minor builder details | ✅ |
| Invariants | 90% | Additional built-ins | ✅ |
| Corrections | 95% | Injection protocol | 🟡 |
| Daemon Core | 85% | IPC protocol, Claude stdio | 🟡 |
| State Management | 95% | Minor edge cases | ✅ |
| Agent Lifecycle | 80% | Claude CLI integration | 🟡 |
| TUI | 75% | IPC client, attachment | 🟡 |
| CLI | 85% | Init templates, simulate | ✅ |
| Cross-cutting | 60% | Config, logging, security | 🟡 |
| Anti-Abandonment | 30% | **CRITICAL** - needs expansion | 🔴 |
| Context Management | 40% | **CRITICAL** - needs expansion | 🔴 |
| Task Packets | 50% | **CRITICAL** - needs expansion | 🔴 |

### Critical Gaps (Must Fix Before Implementation)

1. **Claude CLI stdout/stderr parsing** - How do we detect tool use?
2. **IPC protocol definition** - Daemon ↔ TUI communication
3. **Prompt injection mechanism** - How to send corrections to Claude?
4. **Configuration system** - Where do settings live?
5. **Worker ID persistence** - How do agents identify themselves?
6. **Hooks.json generation** - Integration with Claude Code
7. **Task Packet Format** - Complete structure for subagent handoff
8. **Anti-Abandonment** - Stop hooks, re-injection, todo.md
9. **Context Budget** - 80% rule, token counting
10. **Artifact System** - Compressed handoff format

### Non-Critical Gaps (Can Defer to v1.1)

1. Telemetry/metrics system
2. Plugin architecture  
3. Remote daemon support
4. Multi-project support
5. Visual workflow editor

---

## 2. Mermaid Coverage Audit

Cross-referencing specs against uploaded mermaid diagrams.

### multi-agent.mermaid Coverage

| Concept | Spec-1 | Spec-2 | Gap |
|---------|--------|--------|-----|
| Complexity Assessment | ❌ | ❌ | **Add scaling rules** |
| IC7/IC6/IC5 roles | ✅ | ✅ | - |
| Explore phase (no coding) | ✅ | ✅ | - |
| Plan phase + approval | ✅ | ✅ | - |
| Delegate phase | ✅ | ✅ | - |
| Task packet structure | 🟡 | ❌ | **Expand format** |
| Parallel subagent execution | ✅ | ✅ | - |
| TDD cycle per agent | ✅ | ✅ | - |
| Artifact handoff system | ❌ | ❌ | **Add section** |
| Verification layer | ✅ | ✅ | - |
| Stop hook verification | 🟡 | ❌ | **Add details** |
| Synthesis phase | ✅ | ✅ | - |
| Re-injection pattern | ❌ | ❌ | **Add section** |

### anti-abandonment-patterns.mermaid Coverage

| Pattern | Spec-1 | Spec-2 | Gap |
|---------|--------|--------|-----|
| Explicit success criteria | ✅ | ✅ | - |
| External todo.md | ❌ | ❌ | **Add requirement** |
| Re-injection (5-10 turns) | ❌ | ❌ | **Add pattern** |
| Verification subagents | ✅ | ✅ | - |
| Stop hook enforcement | 🟡 | 🟡 | **Add implementation** |
| PostToolUse hooks | ❌ | ❌ | **Add to hooks.json** |
| SubagentStop hook | ❌ | ❌ | **Add hook type** |
| Anti-overfit verification | ✅ | ✅ | - |
| todo.md format | ❌ | ❌ | **Define format** |
| progress.txt format | ❌ | ❌ | **Define format** |

### context-distribution-flow.mermaid Coverage

| Concept | Spec-1 | Spec-2 | Gap |
|---------|--------|--------|-----|
| Spec decomposition | ✅ | ✅ | - |
| Investigation phase | ✅ | ✅ | - |
| Planning phase | ✅ | ✅ | - |
| Task packet factory | 🟡 | ❌ | **Add factory pattern** |
| Context isolation per agent | 🟡 | ❌ | **Add token budgets** |
| NOT in subagent context | ❌ | ❌ | **Add exclusion rules** |
| Wave-based execution | ✅ | ✅ | - |
| Artifact format (compressed) | ❌ | ❌ | **Define format** |
| Dependency-aware scheduling | ✅ | ✅ | - |
| Context budget allocation | ❌ | ❌ | **Add budgets** |
| 80% rule enforcement | ❌ | ❌ | **Add invariant** |

---

## 3. DSL Package Gaps

### 2.1 Builder Implementation Details

**Gap**: How do builders accumulate state and compile?

**Resolution**:

```typescript
// src/dsl/builders/workflow.ts
export class WorkflowBuilder {
  private _name: string;
  private _resumable: boolean = false;
  private _orchestrator: AgentBuilder | null = null;
  private _phases: PhaseBuilder[] = [];
  private _currentPhase: PhaseBuilder | null = null;
  
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
    return this;
  }
  
  phase(name: string): PhaseBuilder {
    // End previous phase if any
    if (this._currentPhase) {
      this._phases.push(this._currentPhase);
    }
    // Create new phase with back-reference
    this._currentPhase = new PhaseBuilder(name, this);
    return this._currentPhase;
  }
  
  build(): CompiledWorkflow {
    // Finalize last phase
    if (this._currentPhase) {
      this._phases.push(this._currentPhase);
    }
    
    // Validate
    this.validate();
    
    // Compile to JSON structure
    return this.compile();
  }
  
  private validate(): void {
    if (!this._orchestrator) {
      throw new DSLError('Workflow must have an orchestrator');
    }
    if (this._phases.length === 0) {
      throw new DSLError('Workflow must have at least one phase');
    }
    // Check for duplicate phase names
    const names = new Set<string>();
    for (const phase of this._phases) {
      if (names.has(phase.name)) {
        throw new DSLError(`Duplicate phase name: ${phase.name}`);
      }
      names.add(phase.name);
    }
  }
}
```

### 2.2 Phase to Workflow Return

**Gap**: How does PhaseBuilder return control to WorkflowBuilder for chaining?

**Resolution**:

```typescript
// src/dsl/builders/phase.ts
export class PhaseBuilder {
  private _workflow: WorkflowBuilder;
  
  constructor(name: string, workflow: WorkflowBuilder) {
    this._name = name;
    this._workflow = workflow;
  }
  
  // All phase methods return `this` for phase-level chaining
  agent(agent: AgentBuilder): this { /* ... */ return this; }
  expects(...tools: string[]): this { /* ... */ return this; }
  
  // When user calls .phase() again, it goes to workflow
  // This is achieved by making WorkflowBuilder methods available
  
  // Option A: Proxy back to workflow
  phase(name: string): PhaseBuilder {
    return this._workflow.phase(name);
  }
  
  build(): CompiledWorkflow {
    return this._workflow.build();
  }
}
```

### 2.3 Duration Parsing

**Gap**: How is `'10m'` parsed to milliseconds?

**Resolution**:

```typescript
// src/dsl/utils/duration.ts
type DurationUnit = 's' | 'm' | 'h' | 'd';
type Duration = `${number}${DurationUnit}` | number;

const UNIT_MS: Record<DurationUnit, number> = {
  's': 1000,
  'm': 60 * 1000,
  'h': 60 * 60 * 1000,
  'd': 24 * 60 * 60 * 1000,
};

export function parseDuration(duration: Duration): number {
  if (typeof duration === 'number') {
    return duration;
  }
  
  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new DSLError(`Invalid duration: ${duration}`);
  }
  
  const [, value, unit] = match;
  return parseInt(value) * UNIT_MS[unit as DurationUnit];
}
```

### 2.4 Tool Pattern Matching

**Gap**: How does `Bash(npm:*)` pattern work?

**Resolution**:

```typescript
// src/dsl/utils/tool-pattern.ts
interface ToolPattern {
  tool: string;
  pattern?: string;  // Glob for args
}

export function parseToolSpec(spec: string): ToolPattern {
  const match = spec.match(/^(\w+)(?:\(([^)]+)\))?$/);
  if (!match) {
    throw new DSLError(`Invalid tool spec: ${spec}`);
  }
  
  const [, tool, pattern] = match;
  return { tool, pattern: pattern || undefined };
}

export function matchesTool(event: ToolEvent, allowed: ToolPattern[]): boolean {
  for (const pattern of allowed) {
    if (event.tool !== pattern.tool) continue;
    
    if (!pattern.pattern) return true;  // No restriction
    
    // For Bash, pattern matches the command
    if (event.tool === 'Bash') {
      const cmd = event.args?.command || '';
      if (matchGlob(cmd, pattern.pattern)) return true;
    }
  }
  return false;
}

// Examples:
// 'Read' -> { tool: 'Read' } - matches any Read
// 'Bash(npm:*)' -> { tool: 'Bash', pattern: 'npm:*' } - matches npm commands
// 'Bash(git:*)' -> { tool: 'Bash', pattern: 'git:*' } - matches git commands
```

### 2.5 Glob Matching Library

**Gap**: What library for `**/*.test.ts`?

**Resolution**: Use `minimatch` or `picomatch`:

```typescript
// package.json dependencies
{
  "dependencies": {
    "picomatch": "^3.0.0"
  }
}

// src/dsl/utils/glob.ts
import picomatch from 'picomatch';

export function matchGlob(path: string, pattern: string): boolean {
  const isMatch = picomatch(pattern);
  return isMatch(path);
}
```

### 2.6 Context Object Construction

**Gap**: How is `ctx` provided to predicates at runtime?

**Resolution**:

```typescript
// src/daemon/context.ts
export function createContext(
  state: WorkflowState,
  agentId: string,
  task: Task | null,
  trajectory: TrajectoryLogger,
  runtime: Runtime
): Context {
  const agent = state.agents[agentId];
  const phase = state.currentPhase;
  
  return {
    // State references
    task: task ? { ...task, deps: { 
      ids: task.dependencies,
      allComplete: task.dependencies.every(d => 
        state.queues['tasks'].tasks[d]?.status === 'complete'
      ),
    }} : null,
    agent,
    phase,
    workflow: state,
    
    // History
    trajectory: trajectory.filterByAgent(agentId, 100),
    
    // Actions
    exec: async (cmd: string) => {
      const result = await runtime.exec(cmd);
      return {
        exitCode: result.code,
        stdout: result.stdout,
        stderr: result.stderr,
        passed: result.code === 0,
      };
    },
    
    verifiedBy: async (verifierAgent: AgentBuilder) => {
      // Spawn verifier, wait for result
      const result = await runtime.spawnVerifier(verifierAgent, task);
      return result.passed;
    },
    
    // Git
    git: {
      merge: () => runtime.exec('git merge'),
      commit: (msg: string) => runtime.exec(`git commit -m "${msg}"`),
      push: () => runtime.exec('git push'),
    },
    
    // Utilities
    uniqueId: () => crypto.randomUUID(),
    lastCheckpoint: state.checkpoints[phase] || null,
  };
}
```

### 2.7 Queue `.populates()` Semantics

**Gap**: How does `.populates(tasks)` work? Where do tasks come from?

**Resolution**:

The orchestrator agent creates tasks by:
1. Analyzing spec/plan files
2. Writing tasks.md (or tasks.xml)
3. Calling `hyh plan import --file tasks.md`

The daemon then:
1. Parses the file
2. Populates the queue
3. Marks phase as having populated the queue

```typescript
// Phase completion check
function isPhaseComplete(phase: CompiledPhase, state: WorkflowState): boolean {
  // Check outputs exist
  for (const output of phase.outputs) {
    if (!fs.existsSync(output)) return false;
  }
  
  // Check populated queue has tasks
  if (phase.populates) {
    const queue = state.queues[phase.populates];
    if (!queue || Object.keys(queue.tasks).length === 0) return false;
  }
  
  // Check checkpoints
  if (phase.checkpoint) {
    if (!state.checkpoints[phase.checkpoint.id]?.passed) return false;
  }
  
  return true;
}
```

### 2.8 Agent `.spawns()` Mechanism

**Gap**: What does `.spawns(worker)` actually do?

**Resolution**:

`.spawns(worker)` declares that this agent type can spawn worker agents. At runtime:

1. The daemon checks spawn triggers (tasks ready + phase active)
2. Daemon spawns claude CLI processes for workers
3. The "parent" agent (orchestrator) is notified via stdout injection

```typescript
// Compiled workflow includes spawn relationships
interface CompiledAgent {
  spawns: string[];  // Agent types this can spawn
}

// Daemon spawn trigger
function checkSpawnTriggers(workflow: CompiledWorkflow, state: WorkflowState): SpawnSpec[] {
  const phase = getCurrentPhase(workflow, state);
  if (!phase || !phase.queue) return [];
  
  const agentDef = workflow.agents[phase.agent];
  const queue = state.queues[phase.queue];
  
  // Find ready tasks
  const readyTasks = Object.values(queue.tasks).filter(t => 
    t.status === 'pending' && isTaskReady(t, queue, state)
  );
  
  // Count active workers of this type
  const activeCount = Object.values(state.agents).filter(a => 
    a.type === phase.agent && a.status === 'active'
  ).length;
  
  // Calculate how many to spawn
  const maxParallel = phase.parallel === true ? Infinity : (phase.parallel || 1);
  const toSpawn = Math.min(readyTasks.length, maxParallel - activeCount);
  
  return readyTasks.slice(0, toSpawn).map(task => ({
    agentType: phase.agent,
    taskId: task.id,
  }));
}
```

---

## 4. Daemon Gaps

### 3.1 IPC Protocol Definition

**Gap**: What's the message format between daemon and TUI?

**Resolution**:

```typescript
// src/daemon/ipc/protocol.ts

// Request types
type IPCRequest = 
  | { type: 'subscribe' }
  | { type: 'unsubscribe' }
  | { type: 'get_state' }
  | { type: 'get_trajectory'; limit?: number }
  | { type: 'human_action'; checkpointId: string; action: 'approve' | 'reject' }
  | { type: 'pause_agent'; agentId: string }
  | { type: 'resume_agent'; agentId: string }
  | { type: 'kill_agent'; agentId: string }
  | { type: 'attach_agent'; agentId: string };

// Response types
type IPCResponse =
  | { type: 'state'; state: WorkflowState }
  | { type: 'trajectory'; events: TrajectoryEvent[] }
  | { type: 'error'; message: string }
  | { type: 'ok' };

// Push events (daemon → TUI)
type IPCEvent =
  | { type: 'state_changed'; state: WorkflowState }
  | { type: 'trajectory_event'; event: TrajectoryEvent }
  | { type: 'agent_output'; agentId: string; data: string }
  | { type: 'human_required'; checkpoint: Checkpoint };

// Wire format: newline-delimited JSON
// Each message: JSON.stringify(msg) + '\n'
```

### 3.2 IPC Server Implementation

**Gap**: Unix socket server details.

**Resolution**:

```typescript
// src/daemon/ipc/server.ts
import net from 'net';
import path from 'path';
import os from 'os';

export class IPCServer {
  private server: net.Server;
  private clients: Set<net.Socket> = new Set();
  private socketPath: string;
  
  constructor(workflowId: string) {
    // Socket path: ~/.hyh/sockets/<workflow-id>.sock
    this.socketPath = path.join(
      os.homedir(), 
      '.hyh', 
      'sockets', 
      `${workflowId}.sock`
    );
  }
  
  async start(): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.socketPath), { recursive: true });
    
    // Remove stale socket
    try { await fs.unlink(this.socketPath); } catch {}
    
    this.server = net.createServer((socket) => {
      this.clients.add(socket);
      
      let buffer = '';
      socket.on('data', (data) => {
        buffer += data.toString();
        
        // Process complete messages (newline-delimited)
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';  // Keep incomplete line
        
        for (const line of lines) {
          if (line.trim()) {
            this.handleMessage(socket, JSON.parse(line));
          }
        }
      });
      
      socket.on('close', () => {
        this.clients.delete(socket);
      });
    });
    
    await new Promise<void>((resolve) => {
      this.server.listen(this.socketPath, resolve);
    });
  }
  
  broadcast(event: IPCEvent): void {
    const message = JSON.stringify(event) + '\n';
    for (const client of this.clients) {
      client.write(message);
    }
  }
  
  private handleMessage(socket: net.Socket, request: IPCRequest): void {
    // Dispatch to handlers...
  }
}
```

### 3.3 Claude CLI Output Parsing

**Gap**: How do we parse Claude's output in `-p` mode?

**Resolution**:

Claude Code CLI with `-p --output-format stream-json` emits:

```jsonl
{"type":"assistant","message":{"content":[{"type":"text","text":"I'll help you..."}]}}
{"type":"tool_use","name":"Read","input":{"path":"src/foo.ts"}}
{"type":"tool_result","content":"file contents..."}
{"type":"assistant","message":{"content":[{"type":"text","text":"Now I'll..."}]}}
{"type":"result","success":true}
```

Parser:

```typescript
// src/daemon/agents/output-parser.ts
import { Transform } from 'stream';

interface ClaudeEvent {
  type: 'assistant' | 'tool_use' | 'tool_result' | 'result' | 'error';
  [key: string]: unknown;
}

export class ClaudeOutputParser extends Transform {
  private buffer = '';
  
  constructor() {
    super({ objectMode: true });
  }
  
  _transform(chunk: Buffer, _encoding: string, callback: Function): void {
    this.buffer += chunk.toString();
    
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const event: ClaudeEvent = JSON.parse(line);
          this.push(event);
        } catch (e) {
          // Not JSON, might be raw output
          this.push({ type: 'raw', data: line });
        }
      }
    }
    
    callback();
  }
}

// Usage in AgentProcess
const parser = new ClaudeOutputParser();
proc.stdout.pipe(parser);

parser.on('data', (event: ClaudeEvent) => {
  if (event.type === 'tool_use') {
    daemon.handleToolUse(agentId, event.name, event.input);
  }
});
```

### 3.4 Prompt Injection Mechanism

**Gap**: How do we inject correction prompts into Claude?

**Resolution**:

Option A: Write to stdin (requires Claude CLI support)
Option B: Use Claude's `--input-format stream-json` mode

```typescript
// src/daemon/agents/agent-process.ts

// Option B: Stream JSON input
export class AgentProcess {
  async injectPrompt(message: string): Promise<void> {
    const injection = {
      type: 'user',
      message: {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `<system_correction>\n${message}\n</system_correction>`,
          },
        ],
      },
    };
    
    this.proc.stdin.write(JSON.stringify(injection) + '\n');
  }
  
  async blockAction(message: string): Promise<void> {
    // For blocking, we need to intercept before action completes
    // This may require running Claude with a wrapper that we control
    const rejection = {
      type: 'tool_rejection',
      message,
    };
    
    this.proc.stdin.write(JSON.stringify(rejection) + '\n');
  }
}
```

**Note**: This requires testing with actual Claude CLI to confirm the exact protocol. May need to coordinate with Claude Code team or use `--dangerously-skip-permissions` sandbox mode.

### 3.5 Checker Chain Implementation

**Gap**: How are invariants chained and executed?

**Resolution**:

```typescript
// src/daemon/checkers/chain.ts
export class CheckerChain {
  private checkers: InvariantChecker[] = [];
  
  constructor(workflow: CompiledWorkflow) {
    // Build checkers from workflow
    for (const agent of Object.values(workflow.agents)) {
      for (const inv of agent.invariants) {
        this.checkers.push(this.compileInvariant(inv, agent.name));
      }
    }
    
    // Add phase tool checkers
    for (const phase of workflow.phases) {
      if (phase.expects.length > 0 || phase.forbids.length > 0) {
        this.checkers.push(this.compilePhaseChecker(phase));
      }
    }
  }
  
  check(agentId: string, event: TrajectoryEvent, state: WorkflowState): Violation | null {
    for (const checker of this.checkers) {
      if (checker.appliesTo(agentId, state)) {
        const violation = checker.check(event, state);
        if (violation) return violation;
      }
    }
    return null;
  }
  
  private compileInvariant(inv: CompiledInvariant, agentName: string): InvariantChecker {
    switch (inv.type) {
      case 'tdd':
        return new TddChecker(inv, agentName);
      case 'fileScope':
        return new FileScopeChecker(inv, agentName);
      case 'noCode':
        return new NoCodeChecker(agentName);
      // ... etc
    }
  }
}
```

---

## 5. TUI Gaps

### 4.1 IPC Client

**Gap**: How does TUI connect to daemon?

**Resolution**:

```typescript
// src/tui/ipc-client.ts
import net from 'net';
import { EventEmitter } from 'events';

export class DaemonClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private buffer = '';
  
  async connect(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(socketPath);
      
      this.socket.on('connect', () => {
        this.send({ type: 'subscribe' });
        resolve();
      });
      
      this.socket.on('data', (data) => {
        this.buffer += data.toString();
        const lines = this.buffer.split('\n');
        this.buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            const event = JSON.parse(line);
            this.emit(event.type, event);
          }
        }
      });
      
      this.socket.on('error', reject);
    });
  }
  
  send(request: IPCRequest): void {
    this.socket?.write(JSON.stringify(request) + '\n');
  }
  
  async request<T>(request: IPCRequest): Promise<T> {
    return new Promise((resolve) => {
      const handler = (response: T) => {
        this.off('response', handler);
        resolve(response);
      };
      this.on('response', handler);
      this.send(request);
    });
  }
}
```

### 4.2 Agent Attachment

**Gap**: How does "attach to agent" work?

**Resolution**:

Attachment means showing agent's raw stdout in TUI and optionally allowing input:

```typescript
// src/tui/tabs/AgentAttach.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useStdin } from 'ink';

export function AgentAttach({ daemon, agentId }: Props) {
  const [output, setOutput] = useState<string[]>([]);
  const { stdin } = useStdin();
  
  useEffect(() => {
    // Request attachment
    daemon.send({ type: 'attach_agent', agentId });
    
    // Listen for agent output
    const handler = (event: { agentId: string; data: string }) => {
      if (event.agentId === agentId) {
        setOutput(prev => [...prev.slice(-100), event.data]);
      }
    };
    
    daemon.on('agent_output', handler);
    return () => daemon.off('agent_output', handler);
  }, [agentId]);
  
  // Forward input to agent (optional, for interactive mode)
  useInput((input) => {
    daemon.send({ type: 'agent_input', agentId, input });
  });
  
  return (
    <Box flexDirection="column">
      <Text bold>Attached to {agentId} (Ctrl+D to detach)</Text>
      <Box flexDirection="column" height={20}>
        {output.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
}
```

### 4.3 Human Checkpoint Dialog

**Gap**: How does approval dialog work in TUI?

**Resolution**:

```typescript
// src/tui/components/ApprovalDialog.tsx
import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  checkpoint: Checkpoint;
  onAction: (action: 'approve' | 'reject') => void;
}

export function ApprovalDialog({ checkpoint, onAction }: Props) {
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
      <Text bold color="yellow">⚠ Human Action Required</Text>
      <Text>{checkpoint.question || 'Approve to continue?'}</Text>
      <Box marginTop={1}>
        <Text>[Y] Approve  [N] Reject</Text>
      </Box>
    </Box>
  );
}

// In main App, show dialog when pending
{state.pendingHumanActions.length > 0 && (
  <ApprovalDialog 
    checkpoint={state.pendingHumanActions[0]}
    onAction={(action) => {
      daemon.send({ 
        type: 'human_action', 
        checkpointId: state.pendingHumanActions[0].id,
        action 
      });
    }}
  />
)}
```

---

## 6. CLI Gaps

### 5.1 Init Template

**Gap**: What does `hyh init` create?

**Resolution**:

```typescript
// src/cli/commands/init.ts
const WORKFLOW_TEMPLATE = `\
import { workflow, queue, gate, agent, inv, correct, human } from '@hyh/dsl';

// Define your queues
const tasks = queue('tasks')
  .ready(task => task.deps.allComplete)
  .timeout('10m');

// Define your agents
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

// Define your workflow
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

export async function init(dir: string = '.'): Promise<void> {
  const workflowPath = path.join(dir, 'workflow.ts');
  
  if (await exists(workflowPath)) {
    throw new CLIError('workflow.ts already exists');
  }
  
  // Create workflow.ts
  await fs.writeFile(workflowPath, WORKFLOW_TEMPLATE);
  
  // Create .hyh directory
  await fs.mkdir(path.join(dir, '.hyh'), { recursive: true });
  
  // Create .gitignore entry
  const gitignore = path.join(dir, '.gitignore');
  if (await exists(gitignore)) {
    const content = await fs.readFile(gitignore, 'utf-8');
    if (!content.includes('.hyh/state.json')) {
      await fs.appendFile(gitignore, '\n# hyh\n.hyh/state.json\n.hyh/trajectory.jsonl\n');
    }
  }
  
  console.log('✓ Created workflow.ts');
  console.log('✓ Created .hyh/');
  console.log('\nNext steps:');
  console.log('  1. Edit workflow.ts to define your workflow');
  console.log('  2. Run: hyh validate workflow.ts');
  console.log('  3. Run: hyh run workflow.ts');
}
```

### 5.2 Simulate Command

**Gap**: How does simulation work?

**Resolution**:

```typescript
// src/cli/commands/simulate.ts
export async function simulate(workflowPath: string, options: SimulateOptions): Promise<void> {
  // 1. Compile workflow
  const workflow = await compile(workflowPath);
  
  // 2. Create simulator with mock agents
  const simulator = new Simulator(workflow, {
    // Mock agent behavior
    agentBehavior: options.scenario === 'happy' 
      ? happyPathBehavior 
      : options.scenario === 'failures'
      ? failuresBehavior
      : interactiveBehavior,
  });
  
  // 3. Run simulation
  const trace = await simulator.run();
  
  // 4. Report results
  console.log('\n=== Simulation Results ===\n');
  console.log(`Phases completed: ${trace.phasesCompleted.join(' → ')}`);
  console.log(`Tasks completed: ${trace.tasksCompleted}/${trace.totalTasks}`);
  console.log(`Violations: ${trace.violations.length}`);
  console.log(`Corrections applied: ${trace.corrections.length}`);
  
  if (trace.violations.length > 0) {
    console.log('\nViolations:');
    for (const v of trace.violations) {
      console.log(`  - ${v.type}: ${v.message}`);
    }
  }
}

// Mock behaviors
const happyPathBehavior: AgentBehavior = {
  onTask: async (task) => ({
    toolCalls: [
      { tool: 'Write', path: task.files[0]?.replace('.ts', '.test.ts') },
      { tool: 'Write', path: task.files[0] },
      { tool: 'Bash', args: { command: 'npm test' } },
    ],
    success: true,
  }),
};
```

### 5.3 Worker ID Persistence

**Gap**: How do agents get stable IDs?

**Resolution**:

```typescript
// src/cli/utils/worker-id.ts
import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const WORKER_ID_FILE = path.join(os.homedir(), '.hyh', 'worker-id');

export async function getWorkerId(): Promise<string> {
  // Check environment override
  if (process.env.HYH_WORKER_ID) {
    return process.env.HYH_WORKER_ID;
  }
  
  // Check file
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

---

## 7. Cross-Cutting Concerns

### 6.1 Logging Strategy

**Gap**: No logging strategy defined.

**Resolution**:

```typescript
// src/shared/logger.ts
import pino from 'pino';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  level: LogLevel;
  file?: string;  // Optional file output
}

export function createLogger(name: string, options: LoggerOptions = { level: 'info' }): Logger {
  const streams = [
    // Console (pretty for TTY, JSON otherwise)
    process.stdout.isTTY
      ? { stream: pino.transport({ target: 'pino-pretty' }) }
      : { stream: process.stdout },
  ];
  
  if (options.file) {
    streams.push({ stream: pino.destination(options.file) });
  }
  
  return pino({
    name,
    level: options.level,
  }, pino.multistream(streams));
}

// Usage
const log = createLogger('daemon', { level: 'debug', file: '.hyh/daemon.log' });
log.info({ agentId: 'worker-a3f2' }, 'Agent spawned');
```

### 6.2 Error Codes

**Gap**: No error code system.

**Resolution**:

```typescript
// src/shared/errors.ts
export enum ErrorCode {
  // DSL errors (1xx)
  DSL_INVALID_SYNTAX = 100,
  DSL_MISSING_REQUIRED = 101,
  DSL_DUPLICATE_NAME = 102,
  DSL_INVALID_REFERENCE = 103,
  
  // Daemon errors (2xx)
  DAEMON_ALREADY_RUNNING = 200,
  DAEMON_NOT_RUNNING = 201,
  DAEMON_STATE_CORRUPT = 202,
  
  // Agent errors (3xx)
  AGENT_SPAWN_FAILED = 300,
  AGENT_TIMEOUT = 301,
  AGENT_CRASHED = 302,
  
  // Workflow errors (4xx)
  WORKFLOW_INVALID_TRANSITION = 400,
  WORKFLOW_CHECKPOINT_FAILED = 401,
  
  // CLI errors (5xx)
  CLI_INVALID_ARGS = 500,
  CLI_FILE_NOT_FOUND = 501,
}

export class HyhError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HyhError';
  }
}
```

---

## 8. Integration Protocols

### 7.1 Daemon ↔ Claude CLI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ CLAUDE CLI INTEGRATION                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Spawn Command:                                                             │
│  claude --session-id <uuid>                                                │
│         --model <model>                                                     │
│         --allowed-tools <tools>                                             │
│         --system-prompt <path-to-prompt.md>                                │
│         --output-format stream-json                                         │
│         --input-format stream-json                                          │
│         -p                                                                  │
│                                                                             │
│  stdin (daemon → claude):                                                   │
│    {"type":"user","message":{"content":[{"type":"text","text":"..."}]}}    │
│                                                                             │
│  stdout (claude → daemon):                                                  │
│    {"type":"assistant","message":{...}}                                     │
│    {"type":"tool_use","id":"...","name":"Read","input":{...}}              │
│    {"type":"tool_result","tool_use_id":"...","content":"..."}              │
│    {"type":"result","success":true}                                         │
│                                                                             │
│  stderr: Error messages and logs                                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Agent ↔ hyh CLI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ AGENT CLI INTEGRATION                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Task Claim:                                                                │
│  $ hyh task claim --role implementation                                     │
│  {                                                                          │
│    "task": {                                                                │
│      "id": "T007",                                                          │
│      "description": "Implement token service",                              │
│      "files": ["src/auth/token.ts", "tests/auth/token.test.ts"],           │
│      "instructions": "...",                                                 │
│      "success": "All tests pass"                                            │
│    },                                                                       │
│    "guidance": {                                                            │
│      "steps": ["1. Write tests", "2. Implement", "3. Verify"],             │
│      "warnings": ["Previous attempt failed: missing edge case"]            │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Heartbeat:                                                                 │
│  $ hyh heartbeat                                                            │
│  {"ok": true, "task": "T007", "elapsed": "2m 34s"}                         │
│                                                                             │
│  Task Complete:                                                             │
│  $ hyh task complete --id T007                                              │
│  {"ok": true, "next": "T009"}  # or null if no more tasks                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Edge Cases & Error Handling

### 8.1 DSL Validation Errors

| Error | Detection | Message |
|-------|-----------|---------|
| Duplicate phase name | Build time | "Duplicate phase name: {name}" |
| Unknown agent reference | Build time | "Unknown agent: {name}" |
| Circular task dependency | Build time | "Circular dependency: {path}" |
| Missing required field | Build time | "Agent '{name}' missing model" |
| Invalid tool pattern | Build time | "Invalid tool spec: {spec}" |
| Invalid duration | Build time | "Invalid duration: {value}" |

### 8.2 Runtime Errors

| Error | Detection | Recovery |
|-------|-----------|----------|
| Claude CLI not found | Spawn | Error + instructions to install |
| Model unavailable | API error | Retry with backoff, then fail |
| Disk full | State write | Error + cleanup suggestions |
| Worktree conflict | Git | Error + manual resolution steps |
| Merge conflict | Git | Pause + human intervention |
| Agent crash | Process exit | Log + respawn if retries remain |
| Daemon crash | Process exit | State persisted, resume on restart |

### 8.3 Error Recovery

```typescript
// src/daemon/recovery.ts
export class RecoveryManager {
  async recoverFromCrash(stateFile: string): Promise<WorkflowState | null> {
    // Check for state file
    if (!await exists(stateFile)) {
      return null;
    }
    
    // Load state
    const state = await loadState(stateFile);
    
    // Validate state consistency
    const issues = this.validateState(state);
    if (issues.length > 0) {
      console.warn('State inconsistencies found:');
      for (const issue of issues) {
        console.warn(`  - ${issue}`);
      }
      
      // Attempt auto-repair
      const repaired = this.repairState(state, issues);
      return repaired;
    }
    
    return state;
  }
  
  private validateState(state: WorkflowState): string[] {
    const issues: string[] = [];
    
    // Check for orphaned running tasks (agent died)
    for (const [id, task] of Object.entries(state.queues['tasks']?.tasks || {})) {
      if (task.status === 'running') {
        const agent = Object.values(state.agents).find(a => a.currentTask === id);
        if (!agent || agent.status !== 'active') {
          issues.push(`Task ${id} marked running but no active agent`);
        }
      }
    }
    
    return issues;
  }
  
  private repairState(state: WorkflowState, issues: string[]): WorkflowState {
    // Reset orphaned running tasks to pending
    for (const issue of issues) {
      const match = issue.match(/Task (\S+) marked running/);
      if (match) {
        const taskId = match[1];
        state.queues['tasks'].tasks[taskId].status = 'pending';
        state.queues['tasks'].tasks[taskId].claimedBy = null;
      }
    }
    
    return state;
  }
}
```

---

## 10. Missing: Configuration

**Gap**: No configuration system defined.

**Resolution**:

```typescript
// hyh.config.ts (project root)
import { defineConfig } from '@hyh/dsl';

export default defineConfig({
  // Daemon settings
  daemon: {
    socketPath: '/tmp/hyh-${workflowId}.sock',  // Override socket location
    stateDir: '.hyh',                            // State directory
    logLevel: 'info',
  },
  
  // Claude settings
  claude: {
    defaultModel: 'sonnet',
    maxTokens: 200000,
    timeout: '30m',
  },
  
  // Git settings
  git: {
    mainBranch: 'main',
    worktreeDir: '${projectDir}--${branchName}',
    autoCommit: true,
  },
  
  // TUI settings
  tui: {
    theme: 'dark',
    refreshRate: 100,  // ms
  },
});

// Loading config
// src/shared/config.ts
export async function loadConfig(projectDir: string): Promise<HyhConfig> {
  const configPath = path.join(projectDir, 'hyh.config.ts');
  
  if (await exists(configPath)) {
    // Use tsx or esbuild to load TS config
    const { default: config } = await import(configPath);
    return mergeWithDefaults(config);
  }
  
  return getDefaults();
}
```

---

## 11. Missing: Claude CLI Integration

### 10.1 Claude CLI Version Requirements

```typescript
// src/daemon/agents/claude-cli.ts
const REQUIRED_VERSION = '1.0.0';  // Minimum version with stream-json

export async function checkClaudeCli(): Promise<void> {
  try {
    const { stdout } = await execAsync('claude --version');
    const version = parseVersion(stdout);
    
    if (compareVersions(version, REQUIRED_VERSION) < 0) {
      throw new HyhError(
        ErrorCode.CLI_VERSION_MISMATCH,
        `Claude CLI version ${version} is too old. Required: ${REQUIRED_VERSION}+`
      );
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      throw new HyhError(
        ErrorCode.CLI_NOT_FOUND,
        'Claude CLI not found. Install with: npm install -g @anthropic-ai/claude-code'
      );
    }
    throw e;
  }
}
```

### 10.2 System Prompt Generation

```typescript
// src/dsl/compiler/prompt-generator.ts
export function generateAgentPrompt(agent: CompiledAgent, workflow: CompiledWorkflow): string {
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
    lines.push('### Heartbeat');
    lines.push(`Run \`hyh heartbeat\` every ${formatDuration(agent.heartbeat.interval)}.`);
    lines.push('');
  }
  
  lines.push('### Completing Work');
  lines.push('```bash');
  lines.push('hyh task complete --id <task-id>');
  lines.push('```');
  lines.push('');
  
  lines.push('## Constraints');
  lines.push('');
  for (const inv of agent.invariants) {
    lines.push(`### ${inv.type}`);
    lines.push(getInvariantDescription(inv));
    lines.push('');
  }
  
  lines.push('## Corrections');
  lines.push('');
  lines.push('If you violate a constraint, you will receive a correction prompt.');
  lines.push('Follow the correction instructions immediately.');
  lines.push('');
  
  for (const [type, corrections] of Object.entries(agent.violations || {})) {
    lines.push(`### On ${type} violation`);
    for (const c of corrections as Correction[]) {
      lines.push(`- ${c.type}: ${c.message || '(automatic)'}`);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}
```

---

## 12. Missing: Metrics & Telemetry

User mentioned wanting to approach this empirically. Need metrics:

```typescript
// src/daemon/metrics.ts
interface WorkflowMetrics {
  // Timing
  totalDuration: number;
  phaseDurations: Record<string, number>;
  taskDurations: Record<string, number>;
  
  // Completion
  tasksCompleted: number;
  tasksFailed: number;
  tasksRetried: number;
  
  // Quality
  violationCount: Record<string, number>;
  correctionCount: Record<string, number>;
  humanInterventions: number;
  
  // Efficiency  
  agentSpawns: number;
  totalTokensUsed: number;  // If available from Claude
  parallelism: number;  // Average concurrent agents
}

export class MetricsCollector {
  private metrics: WorkflowMetrics;
  
  record(event: TrajectoryEvent): void {
    // Update metrics based on event type
  }
  
  export(): WorkflowMetrics {
    return { ...this.metrics };
  }
  
  exportPrometheus(): string {
    // For monitoring integration
    return `
hyh_tasks_completed ${this.metrics.tasksCompleted}
hyh_tasks_failed ${this.metrics.tasksFailed}
hyh_violations_total{type="tdd"} ${this.metrics.violationCount['tdd'] || 0}
    `.trim();
  }
}

// CLI command
// hyh metrics [--format json|prometheus]
```

---

## 13. Missing: Claude Code Hooks Generation

**Gap**: How does DSL generate Claude Code hooks.json?

**Resolution**:

```typescript
// src/dsl/compiler/hooks-generator.ts
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
  
  // Stop hook - prevent stopping with incomplete tasks
  hooks.hooks.Stop = [{
    matcher: '',
    hooks: [{
      type: 'command',
      command: 'hyh check-state',
    }],
  }];
  
  // PostToolUse hooks for invariant checking (if real-time checking needed)
  // This is optional - daemon can also check via trajectory
  if (workflow.realTimeChecking) {
    hooks.hooks.PostToolUse = [{
      matcher: 'Write|Edit',
      hooks: [{
        type: 'command',
        command: 'hyh check-tool --tool $TOOL_NAME --path $TOOL_ARG_PATH',
      }],
    }];
  }
  
  return hooks;
}

// Output: .claude/plugins/hyh/hooks/hooks.json
```

---

## 20. Implementation Checklist

### Phase 1: Foundation

- [ ] **@hyh/dsl**
  - [ ] WorkflowBuilder
  - [ ] AgentBuilder
  - [ ] QueueBuilder
  - [ ] GateBuilder
  - [ ] PhaseBuilder
  - [ ] TaskBuilder
  - [ ] Duration parser
  - [ ] Tool pattern parser
  - [ ] Glob utility
  - [ ] Invariant definitions (tdd, fileScope, noCode, etc.)
  - [ ] Correction definitions
  - [ ] DSL validation
  - [ ] Compiler (DSL → JSON)
  - [ ] Prompt generator
  - [ ] Hooks.json generator
  - [ ] XML task generator
  - [ ] Unit tests

- [ ] **CLI scaffolding**
  - [ ] Command structure (Commander.js)
  - [ ] `hyh init`
  - [ ] `hyh validate`
  - [ ] `hyh compile`

### Phase 2: Daemon Core

- [ ] **@hyh/daemon**
  - [ ] Daemon class
  - [ ] Event loop
  - [ ] StateManager (atomic persistence)
  - [ ] TrajectoryLogger (JSONL)
  - [ ] IPC server (Unix socket)
  - [ ] IPC protocol implementation
  - [ ] Config loading
  - [ ] Logger setup
  - [ ] Error handling

- [ ] **CLI commands**
  - [ ] `hyh run` (basic, single agent)
  - [ ] `hyh status` (non-TUI)

### Phase 3: Agent Management

- [ ] **Agent spawning**
  - [ ] Claude CLI integration
  - [ ] Output parser (stream-json)
  - [ ] Process management
  - [ ] Heartbeat monitor
  - [ ] Session management

- [ ] **Invariant checking**
  - [ ] CheckerChain
  - [ ] TddChecker
  - [ ] FileScopeChecker
  - [ ] NoCodeChecker
  - [ ] Phase tool checker

- [ ] **Corrections**
  - [ ] Prompt injection
  - [ ] Block action
  - [ ] Restart agent
  - [ ] Reassign task
  - [ ] Escalation

- [ ] **CLI commands**
  - [ ] `hyh task claim`
  - [ ] `hyh task complete`
  - [ ] `hyh heartbeat`

### Phase 4: Multi-Agent

- [ ] **Spawn triggers**
  - [ ] Phase-based spawning
  - [ ] Parallel workers
  - [ ] Queue management

- [ ] **Worktree management**
  - [ ] Wave detection
  - [ ] Worktree creation
  - [ ] Merge on wave complete
  - [ ] Cleanup

- [ ] **Gates & checkpoints**
  - [ ] Gate execution
  - [ ] Human checkpoints
  - [ ] Approval flow

### Phase 5: TUI

- [ ] **@hyh/tui**
  - [ ] IPC client
  - [ ] App structure
  - [ ] Tab navigation
  - [ ] Overview tab
  - [ ] Agents tab
  - [ ] Tasks tab
  - [ ] Logs tab
  - [ ] Trajectory tab
  - [ ] Agent attachment
  - [ ] Approval dialog
  - [ ] Keyboard shortcuts

- [ ] **CLI commands**
  - [ ] `hyh status` (TUI mode)
  - [ ] `hyh dev` (watch + TUI)

### Phase 6: Polish

- [ ] **Resumability**
  - [ ] State recovery
  - [ ] Session resume
  - [ ] Orphan task detection

- [ ] **Simulation**
  - [ ] Mock agents
  - [ ] Scenario runner
  - [ ] `hyh simulate`

- [ ] **Metrics**
  - [ ] MetricsCollector
  - [ ] `hyh metrics`

- [ ] **Documentation**
  - [ ] README
  - [ ] API docs
  - [ ] Examples

- [ ] **Testing**
  - [ ] Unit tests (90%+ coverage)
  - [ ] Integration tests
  - [ ] E2E tests with real Claude

---

## Appendix: Open Questions for Implementation

1. **Claude CLI stream-json**: Need to verify exact format with real CLI. May need to coordinate with Claude Code team.

2. **Prompt injection**: Does Claude CLI support injecting prompts mid-conversation via stdin? May need alternative approach.

3. **Tool blocking**: Can we reject a tool use before it executes? May need to run Claude in sandbox mode with our own tool executor.

4. **Token counting**: Can we get token usage from Claude CLI? Important for metrics.

5. **Concurrent TUI clients**: Do we need to support multiple TUI instances? If yes, need subscription management.

---

## 14. Missing: Task Packet Format

**Gap**: The mermaid diagrams define detailed task packet structure but specs don't fully specify it.

### 14.1 Task Packet Schema

```typescript
// src/dsl/types/task-packet.ts
interface TaskPacket {
  // Identity
  id: string;
  name: string;
  wave: number;  // Dependency wave (0 = no deps, 1 = depends on wave 0, etc.)
  
  // Objective
  objective: string;  // Single clear goal
  description: string;  // Detailed description
  
  // Scope
  files: {
    modify: string[];    // Files agent CAN modify
    read: string[];      // Files agent can read for context
    create: string[];    // Files agent should create
  };
  
  // Interface Contract
  interface: {
    inputs: InterfaceSpec[];   // What this task receives
    outputs: InterfaceSpec[];  // What this task produces
  };
  
  // Constraints
  constraints: {
    doNot: string[];     // Explicit "do NOT" list
    maxTokens?: number;  // Context budget for this task
    timeout?: Duration;  // Max time for task
  };
  
  // Success Criteria
  success: {
    tests: string[];      // Test files that must pass
    typecheck: boolean;   // Must typecheck
    lint: boolean;        // Must lint clean
    custom?: string[];    // Custom verification commands
  };
  
  // Tools
  tools: string[];  // Allowed tools for this task
  
  // Dependencies
  dependencies: string[];  // Task IDs this depends on
  
  // Metadata
  role?: string;    // Agent role to assign
  model?: Model;    // Override model
  priority?: number;
}

interface InterfaceSpec {
  name: string;
  type: string;
  description: string;
}
```

### 14.2 Task Packet XML Format

For Claude consumption:

```xml
<task id="token-service" wave="0">
  <objective>Implement JWT token generation and validation</objective>
  
  <scope>
    <modify>src/auth/token.ts</modify>
    <modify>tests/auth/token.test.ts</modify>
    <read>src/types/auth.ts</read>
    <create>src/auth/token.ts</create>
  </scope>
  
  <interface>
    <input name="UserCredentials" type="{ userId: string, roles: string[] }"/>
    <output name="SignedToken" type="{ token: string, expiresAt: number }"/>
  </interface>
  
  <constraints>
    <do-not>Modify session handling code</do-not>
    <do-not>Add new dependencies without approval</do-not>
    <do-not>Touch HTTP layer</do-not>
    <max-context-tokens>15000</max-context-tokens>
  </constraints>
  
  <success>
    <test>tests/auth/token.test.ts</test>
    <typecheck>true</typecheck>
    <lint>true</lint>
  </success>
  
  <tools>Read,Write,Edit,Bash(npm test:*),Bash(git:*),Bash(hyh:*)</tools>
</task>
```

### 14.3 Task Packet Factory

The orchestrator creates task packets during plan phase:

```typescript
// src/daemon/task-factory.ts
export class TaskPacketFactory {
  createFromPlan(plan: Plan, codebase: CodebaseAnalysis): TaskPacket[] {
    const packets: TaskPacket[] = [];
    
    for (const task of plan.tasks) {
      packets.push({
        id: task.id,
        name: task.name,
        wave: this.calculateWave(task, plan.tasks),
        objective: task.objective,
        description: task.description,
        files: {
          modify: task.files,
          read: this.findReadContext(task, codebase),
          create: task.files.filter(f => !codebase.exists(f)),
        },
        interface: this.extractInterface(task, codebase),
        constraints: {
          doNot: this.generateDoNotList(task, plan),
          maxTokens: 15000,  // Default context budget
        },
        success: {
          tests: this.findTestFiles(task),
          typecheck: true,
          lint: true,
        },
        tools: this.deriveTools(task),
        dependencies: task.dependencies,
      });
    }
    
    return packets;
  }
  
  private generateDoNotList(task: Task, plan: Plan): string[] {
    const doNot: string[] = [];
    
    // Don't touch other tasks' files
    for (const other of plan.tasks) {
      if (other.id !== task.id) {
        for (const file of other.files) {
          if (!task.files.includes(file)) {
            doNot.push(`Modify ${file} (owned by task ${other.id})`);
          }
        }
      }
    }
    
    return doNot;
  }
}
```

---

## 15. Missing: Anti-Abandonment Patterns

**Gap**: Critical anti-abandonment mechanisms from mermaid not fully specified.

### 15.1 External todo.md

Agents MUST maintain external todo.md for persistence across compaction:

```typescript
// src/dsl/invariants/todo.ts
export const todoInvariant = inv.externalTodo({
  file: 'todo.md',
  format: 'checklist',
  updateAfter: ['Write', 'Edit', 'Bash'],
  checkBeforeStop: true,
});

// Generated checker
function checkTodoComplete(todoPath: string): Violation | null {
  const content = fs.readFileSync(todoPath, 'utf-8');
  const incomplete = content.match(/- \[ \]/g);
  
  if (incomplete && incomplete.length > 0) {
    return {
      type: 'incomplete_todo',
      message: `${incomplete.length} todo items incomplete`,
      correction: { type: 'block', message: 'Complete all todo items before stopping.' },
    };
  }
  return null;
}
```

### 15.2 todo.md Format

```markdown
# Authentication Feature

## Phase 1: Setup
- [x] Read existing auth code
- [x] Document patterns  
- [x] Create plan.md

## Phase 2: Token Service
- [x] Write token tests (RED)
- [x] Implement token.ts (GREEN)
- [ ] Run full test suite

## Phase 3: Integration
- [ ] Wire up API endpoints
- [ ] Integration tests
```

### 15.3 progress.txt Format

For cross-session state:

```markdown
# Session State
- Last completed: Token generation
- Next task: Session management
- Blockers: None

# Key Decisions
- JWT for tokens
- 1h expiration default

# Files Modified
- src/auth/token.ts
- tests/auth/token.test.ts

# Context for Resume
[Compressed summary of key learnings]
```

### 15.4 Stop Hook Verification

```typescript
// Generated hooks.json
{
  "hooks": {
    "Stop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "hyh verify-complete",
        "timeout": 120
      }]
    }]
  }
}

// hyh verify-complete command
async function verifyComplete(): Promise<number> {
  const checks = [
    { name: 'todo', fn: () => checkTodoComplete('todo.md') },
    { name: 'tests', fn: () => exec('npm test') },
    { name: 'typecheck', fn: () => exec('npm run typecheck') },
    { name: 'lint', fn: () => exec('npm run lint') },
  ];
  
  for (const check of checks) {
    const result = await check.fn();
    if (!result.passed) {
      console.log(`❌ ${check.name} failed`);
      console.log(`Continue working. Issues: ${result.message}`);
      return 1;  // Block stop
    }
  }
  
  console.log('✅ All checks passed');
  return 0;  // Allow stop
}
```

### 15.5 SubagentStop Hook

New hook type for controlling subagent completion:

```typescript
// DSL extension
const worker = agent('worker')
  .subagentStop({
    verify: [
      ctx => ctx.exec('npm test'),
      ctx => ctx.checkTodo(),
    ],
    onFail: correct.prompt('Verification failed. Continue until all criteria met.'),
  });

// Generated hooks.json
{
  "hooks": {
    "SubagentStop": [{
      "matcher": "",
      "hooks": [{
        "type": "command",
        "command": "hyh subagent-verify --task-id $TASK_ID",
        "timeout": 120
      }]
    }]
  }
}
```

### 15.6 PostToolUse Hooks

Immediate feedback loop after Write/Edit:

```typescript
// DSL
const worker = agent('worker')
  .postToolUse({
    matcher: 'Write|Edit',
    run: [
      'npm run typecheck',
      'npm run lint --fix',
    ],
  });

// Generated hooks.json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Write|Edit",
      "hooks": [{
        "type": "command",
        "command": "npm run typecheck && npm run lint --fix",
        "timeout": 30
      }]
    }]
  }
}
```

---

## 16. Missing: Context Budget Management

**Gap**: 80% rule and context budgets not fully specified.

### 16.1 Context Budget Allocation

```typescript
interface ContextBudget {
  orchestrator: number;   // ~50K tokens (full plan + all artifacts)
  worker: number;         // ~15-20K tokens (single task packet)
  verifier: number;       // ~25K tokens (implementation + tests)
  integration: number;    // ~30K tokens (all interfaces + API)
}

const DEFAULT_BUDGETS: ContextBudget = {
  orchestrator: 50000,
  worker: 15000,
  verifier: 25000,
  integration: 30000,
};
```

### 16.2 Context Invariant

```typescript
// DSL
export const contextBudget = inv.contextLimit({
  max: 0.8,  // 80% of model's context window
  warn: 0.6, // Warn at 60%
  onExceed: correct.compact({
    preserve: ['decisions', 'bugs', 'paths', 'interfaces'],
    discard: ['exploration', 'superseded'],
  }),
});

// Implementation
function checkContextBudget(agentId: string, trajectory: TrajectoryEvent[]): Violation | null {
  const tokenCount = estimateTokens(trajectory);
  const limit = getContextLimit(agentId);
  
  if (tokenCount > limit * 0.8) {
    return {
      type: 'context_exceeded',
      message: `Context at ${Math.round(tokenCount / limit * 100)}%`,
      correction: { type: 'compact', preserveTypes: ['decisions', 'bugs'] },
    };
  }
  
  return null;
}
```

### 16.3 Context Isolation Rules

What NOT to include in subagent context:

```typescript
interface ContextExclusions {
  // Never include in subagent context
  exclude: [
    'full_codebase',           // Only relevant files
    'other_task_packets',      // Only assigned task
    'previous_conversation',   // Fresh context
    'unrelated_modules',       // Only dependencies
    'full_plan',               // Only relevant section
  ];
  
  // Always include
  include: [
    'system_prompt',
    'task_packet',
    'interface_contracts',
    'existing_file_if_modify',
    'test_template',
  ];
}
```

### 16.4 PreCompact Hook

Custom preservation logic:

```typescript
// DSL
workflow('feature')
  .preCompact({
    preserve: [
      'decisions',      // Key decisions made
      'bugs_found',     // Bugs discovered
      'file_paths',     // Modified file paths
      'interfaces',     // API contracts
      'blockers',       // Current blockers
    ],
    summarize: [
      'exploration',    // Compress exploration
      'failed_attempts', // Compress failures
    ],
    discard: [
      'superseded_plans',
      'verbose_output',
    ],
  });
```

---

## 17. Missing: Artifact System

**Gap**: Compressed artifact handoff format not specified.

### 17.1 Artifact Format

```typescript
interface Artifact {
  taskId: string;
  status: 'complete' | 'partial' | 'failed';
  
  // Summary (for orchestrator context)
  summary: {
    objective: string;
    outcome: string;
    tokenCount: number;  // Should be ~800-1500 tokens
  };
  
  // Files
  files: {
    modified: string[];
    created: string[];
  };
  
  // Interface (for dependent tasks)
  exports: {
    name: string;
    type: string;
    location: string;
  }[];
  
  // Test results
  tests: {
    total: number;
    passed: number;
    coverage?: number;
  };
  
  // Integration notes
  notes: string[];
}
```

### 17.2 Artifact Markdown Format

```markdown
# Token Service Implementation

## Status: Complete

## Files Modified
- src/auth/token.ts (created)
- tests/auth/token.test.ts (created)

## Exported Interface
```typescript
export function generateToken(creds: UserCredentials): SignedToken;
export function validateToken(token: string): TokenPayload | null;
```

## Test Coverage
- 8 tests passing
- Edge cases: expired tokens, invalid signatures, malformed input

## Integration Notes
- Requires JWT_SECRET environment variable
- Token expiration default: 1 hour
- Uses HS256 algorithm

## Token Count: ~800 tokens
```

### 17.3 Artifact Storage

```typescript
// Location: .hyh/artifacts/<task-id>.md

// Daemon reads artifacts for:
// 1. Orchestrator synthesis
// 2. Dependent task context
// 3. Verification agents

class ArtifactManager {
  async save(taskId: string, artifact: Artifact): Promise<void> {
    const path = `.hyh/artifacts/${taskId}.md`;
    const content = this.formatMarkdown(artifact);
    await fs.writeFile(path, content);
  }
  
  async loadForTask(taskId: string, dependencies: string[]): Promise<string> {
    // Load only artifacts from dependencies
    const artifacts: string[] = [];
    for (const depId of dependencies) {
      const artifact = await this.load(depId);
      if (artifact) {
        artifacts.push(this.extractInterface(artifact));
      }
    }
    return artifacts.join('\n\n');
  }
}
```

---

## 18. Missing: Re-injection Pattern

**Gap**: Context drift prevention not specified.

### 18.1 Re-injection Invariant

```typescript
// DSL
const worker = agent('worker')
  .reinject({
    every: 5,  // Every 5 tool uses
    content: ctx => `
## Reminder: Original Task

${ctx.task.objective}

## Success Criteria
${ctx.task.success.tests.map(t => `- ${t} passes`).join('\n')}

## Remaining Todo
${ctx.readTodo().incomplete.map(i => `- [ ] ${i}`).join('\n')}

Continue with next incomplete item.
`,
  });

// Implementation
class ReinjectionManager {
  private toolCounts: Map<string, number> = new Map();
  
  onToolUse(agentId: string): string | null {
    const count = (this.toolCounts.get(agentId) || 0) + 1;
    this.toolCounts.set(agentId, count);
    
    const config = this.getConfig(agentId);
    if (count % config.every === 0) {
      return this.generateReinjection(agentId);
    }
    
    return null;
  }
}
```

### 18.2 Re-injection Content

```markdown
---
## 🔄 Task Reminder (Turn 10)

### Original Objective
Implement JWT token generation and validation

### Success Criteria
- [ ] tests/auth/token.test.ts passes
- [x] TypeScript compiles
- [ ] Lint clean

### Remaining Items
- [ ] Run full test suite
- [ ] Add edge case tests

Continue with next incomplete item.
---
```

---

## 19. Missing: Scaling Rules

**Gap**: Complexity-based agent scaling not specified.

### 19.1 Complexity Assessment

```typescript
// DSL
workflow('feature')
  .scaling({
    trivial: { maxHours: 1, agents: 0 },      // Direct guidance
    small: { maxHours: 3, agents: 1 },        // 1 subagent + verification
    medium: { maxHours: 8, agents: 3 },       // 2-3 subagents
    large: { maxDays: 3, agents: 5 },         // 5+ subagents + milestones
    huge: { maxDays: 14, agents: 10 },        // 10+ subagents + phased
  });

// Orchestrator uses this to decide delegation
function assessComplexity(task: Task): Complexity {
  const factors = {
    fileCount: task.files.length,
    dependencyCount: task.dependencies.length,
    estimatedHours: task.estimatedHours,
    hasIntegration: task.requiresIntegration,
  };
  
  if (factors.estimatedHours <= 1) return 'trivial';
  if (factors.estimatedHours <= 3 && factors.fileCount <= 3) return 'small';
  if (factors.estimatedHours <= 8) return 'medium';
  if (factors.estimatedHours <= 24) return 'large';
  return 'huge';
}
```

### 19.2 Automatic Agent Allocation

```typescript
function allocateAgents(plan: Plan, scaling: ScalingConfig): AgentAllocation {
  const complexity = assessComplexity(plan);
  const config = scaling[complexity];
  
  if (config.agents === 0) {
    return { type: 'direct', agents: [] };
  }
  
  // Group tasks into waves
  const waves = groupByWave(plan.tasks);
  
  // Allocate agents per wave based on parallelism
  const allocation: AgentAllocation = {
    type: 'delegated',
    agents: [],
  };
  
  for (const wave of waves) {
    const parallel = Math.min(wave.tasks.length, config.agents);
    allocation.agents.push({
      wave: wave.id,
      count: parallel,
      tasks: wave.tasks,
    });
  }
  
  return allocation;
}
```

---

## 20. Implementation Checklist (Updated)

### Phase 1: Foundation (2-3 weeks)

- [ ] **@hyh/dsl**
  - [ ] WorkflowBuilder
  - [ ] AgentBuilder  
  - [ ] QueueBuilder
  - [ ] GateBuilder
  - [ ] PhaseBuilder
  - [ ] TaskBuilder
  - [ ] Duration parser
  - [ ] Tool pattern parser
  - [ ] Glob utility (picomatch)
  - [ ] Invariant definitions
    - [ ] inv.tdd()
    - [ ] inv.fileScope()
    - [ ] inv.noCode()
    - [ ] inv.readOnly()
    - [ ] inv.mustProgress()
    - [ ] inv.mustReport()
    - [ ] **inv.externalTodo()** ← NEW
    - [ ] **inv.contextLimit()** ← NEW
  - [ ] Correction definitions
  - [ ] DSL validation
  - [ ] Compiler (DSL → JSON)
  - [ ] **Task packet generator** ← NEW
  - [ ] Prompt generator
  - [ ] Hooks.json generator
    - [ ] Stop hook
    - [ ] **SubagentStop hook** ← NEW
    - [ ] **PostToolUse hook** ← NEW
    - [ ] **PreCompact hook** ← NEW
  - [ ] XML task generator
  - [ ] Unit tests

- [ ] **CLI scaffolding**
  - [ ] Command structure (Commander.js)
  - [ ] `hyh init`
  - [ ] `hyh validate`
  - [ ] `hyh compile`

### Phase 2: Daemon Core (2-3 weeks)

- [ ] **@hyh/daemon**
  - [ ] Daemon class
  - [ ] Event loop
  - [ ] StateManager (atomic persistence)
  - [ ] TrajectoryLogger (JSONL)
  - [ ] IPC server (Unix socket)
  - [ ] IPC protocol implementation
  - [ ] Config loading
  - [ ] Logger setup (pino)
  - [ ] Error handling
  - [ ] **TaskPacketFactory** ← NEW
  - [ ] **ArtifactManager** ← NEW
  - [ ] **ReinjectionManager** ← NEW
  - [ ] **ContextBudgetMonitor** ← NEW

- [ ] **CLI commands**
  - [ ] `hyh run` (basic, single agent)
  - [ ] `hyh status` (non-TUI)
  - [ ] **`hyh verify-complete`** ← NEW
  - [ ] **`hyh subagent-verify`** ← NEW

### Phase 3: Agent Management (2-3 weeks)

- [ ] **Agent spawning**
  - [ ] Claude CLI integration
  - [ ] Output parser (stream-json)
  - [ ] Process management
  - [ ] Heartbeat monitor
  - [ ] Session management

- [ ] **Invariant checking**
  - [ ] CheckerChain
  - [ ] TddChecker
  - [ ] FileScopeChecker
  - [ ] NoCodeChecker
  - [ ] Phase tool checker
  - [ ] **TodoChecker** ← NEW
  - [ ] **ContextBudgetChecker** ← NEW

- [ ] **Corrections**
  - [ ] Prompt injection
  - [ ] Block action
  - [ ] Restart agent
  - [ ] Reassign task
  - [ ] Escalation
  - [ ] **Compact (PreCompact)** ← NEW
  - [ ] **Reinject** ← NEW

- [ ] **CLI commands**
  - [ ] `hyh task claim`
  - [ ] `hyh task complete`
  - [ ] `hyh heartbeat`

### Phase 4: Multi-Agent (2 weeks)

- [ ] **Spawn triggers**
  - [ ] Phase-based spawning
  - [ ] Parallel workers
  - [ ] Queue management
  - [ ] **Scaling rules** ← NEW

- [ ] **Worktree management**
  - [ ] Wave detection
  - [ ] Worktree creation
  - [ ] Merge on wave complete
  - [ ] Cleanup

- [ ] **Gates & checkpoints**
  - [ ] Gate execution
  - [ ] Human checkpoints
  - [ ] Approval flow

- [ ] **Artifact system** ← NEW
  - [ ] Artifact generation
  - [ ] Artifact storage
  - [ ] Artifact loading for deps

### Phase 5: TUI (2 weeks)

- [ ] **@hyh/tui**
  - [ ] IPC client
  - [ ] App structure
  - [ ] Tab navigation
  - [ ] Overview tab
  - [ ] Agents tab
  - [ ] Tasks tab
  - [ ] Logs tab
  - [ ] Trajectory tab
  - [ ] Agent attachment
  - [ ] Approval dialog
  - [ ] Keyboard shortcuts
  - [ ] **Todo progress display** ← NEW
  - [ ] **Context budget display** ← NEW

- [ ] **CLI commands**
  - [ ] `hyh status` (TUI mode)
  - [ ] `hyh dev` (watch + TUI)

### Phase 6: Polish (1-2 weeks)

- [ ] **Resumability**
  - [ ] State recovery
  - [ ] Session resume
  - [ ] Orphan task detection

- [ ] **Simulation**
  - [ ] Mock agents
  - [ ] Scenario runner
  - [ ] `hyh simulate`

- [ ] **Metrics**
  - [ ] MetricsCollector
  - [ ] `hyh metrics`

- [ ] **Documentation**
  - [ ] README
  - [ ] API docs
  - [ ] Examples

- [ ] **Testing**
  - [ ] Unit tests (90%+ coverage)
  - [ ] Integration tests
  - [ ] E2E tests with real Claude

---

## Appendix B: Complete DSL Example (Updated)

With all anti-abandonment patterns:

```typescript
import { 
  workflow, queue, gate, agent, inv, correct, human, task 
} from '@hyh/dsl';

// === QUEUES ===

const tasks = queue('tasks')
  .ready(task => task.deps.allComplete)
  .timeout('10m')
  .examples(
    task('token-service').files('src/auth/token.ts').wave(0),
    task('session-manager').files('src/auth/session.ts').wave(0),
    task('auth-api').depends('token-service', 'session-manager').files('src/api/auth.ts').wave(1),
  );

const verification = queue('verification');

// === GATES ===

const qualityGate = gate('quality')
  .requires(ctx => ctx.exec('npm test'))
  .requires(ctx => ctx.exec('npm run typecheck'))
  .requires(ctx => ctx.checkTodo())  // External todo check
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
    inv.contextLimit({ max: 0.8, warn: 0.6 }),
  )
  .preCompact({
    preserve: ['decisions', 'interfaces', 'blockers'],
    discard: ['exploration'],
  })
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
    inv.externalTodo({ file: 'todo.md', checkBeforeStop: true }),
    inv.contextLimit({ max: 0.8 }),
  )
  .reinject({
    every: 5,
    content: ctx => `
## Reminder: ${ctx.task.objective}
Remaining: ${ctx.todo.incomplete.length} items
Continue with next incomplete item.
`,
  })
  .postToolUse({
    matcher: 'Write|Edit',
    run: ['npm run typecheck', 'npm run lint --fix'],
  })
  .subagentStop({
    verify: [
      ctx => ctx.checkTodo(),
      ctx => ctx.exec('npm test'),
    ],
  })
  .onViolation('tdd', 
    correct.prompt('Delete implementation. Write failing tests first.')
      .then(correct.restart())
      .then(correct.escalate('orchestrator'))
  )
  .onViolation('fileScope', correct.block())
  .onViolation('externalTodo', correct.prompt('Complete all todo items before stopping.'));

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
  .scaling({
    trivial: { maxHours: 1, agents: 0 },
    small: { maxHours: 3, agents: 1 },
    medium: { maxHours: 8, agents: 3 },
    large: { maxDays: 3, agents: 5 },
  })
  
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
    .contextBudget(15000)  // Per-agent budget
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

## Appendix C: Critical Implementation Notes

### C.1 Claude CLI Compatibility

Before implementation, verify with Claude Code team:

1. **Stream JSON format**: `--output-format stream-json` exact schema
2. **Input injection**: Can we write to stdin mid-conversation?
3. **Tool rejection**: Can we reject tool use before execution?
4. **Session flags**: `--session-id`, `--resume` behavior
5. **Exit codes**: What codes indicate success/failure/interrupt?

### C.2 Hooks Integration

The DSL generates `.claude/hooks/hooks.json`. Verify compatibility with:

1. Hook types: `SessionStart`, `Stop`, `PostToolUse`, `PreCompact`, `SubagentStop`
2. Matcher syntax for tool filtering
3. Command timeout behavior
4. Environment variables passed to hook commands

### C.3 Token Estimation

For context budget management:

```typescript
// Rough estimation: 1 token ≈ 4 characters
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// More accurate: use tiktoken or Claude's tokenizer
import { encode } from 'tiktoken';
function countTokens(text: string): number {
  return encode(text).length;
}
```

### C.4 Race Conditions

Handle these carefully:

1. **Task claiming**: Two agents claiming same task
2. **State updates**: Daemon + agent writing state.json
3. **Worktree merges**: Concurrent merges from different waves
4. **Socket writes**: Multiple TUI clients sending commands

Use file locking and atomic operations where needed.

---

*End of SPEC-3*
