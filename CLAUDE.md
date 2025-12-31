# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**hyh (Hold Your Horses)** is a TypeScript workflow orchestration system for multi-agent Claude Code execution. It consists of a DSL for defining workflows, a daemon runtime engine, a CLI, and an Ink-based TUI.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Run single test file
pnpm test packages/daemon/src/checkers/tdd.test.ts

# Run tests matching pattern
pnpm test -- --reporter=verbose --grep "allows test file writes"

# Watch mode
pnpm test:watch

# Type checking only
pnpm typecheck

# Lint
pnpm lint
```

## Architecture

### Package Structure

```
packages/
├── dsl/      # Fluent builder DSL for workflow definitions
├── daemon/   # Runtime engine (state, agents, checkers, IPC)
├── cli/      # Commander.js CLI commands
└── tui/      # React + Ink terminal UI
```

### Core Runtime Flow

The **Daemon** is the central runtime engine:

```
Daemon
├── StateManager      # Persistent JSON state with mutex-locked updates
├── AgentManager      # Spawns claude CLI processes with JSON stream I/O
├── EventLoop         # Tick-based execution (spawn, heartbeat, phase checks)
├── CheckerChain      # Validates invariants (TDD, file scope, context budget)
├── CorrectionApplicator  # Enforces policy via prompt injection
├── TrajectoryLogger  # JSONL event stream to .hyh/trajectory.jsonl
└── IPCServer         # Unix socket RPC for CLI/TUI communication
```

### Key Patterns

**State Management**: Atomic updates via `StateManager.update(callback)` with temp file → fsync → rename pattern.

**IPC Protocol**: Discriminated union requests/responses over Unix sockets. Key requests: `get_state`, `task_claim`, `task_complete`, `heartbeat`, `subscribe`.

**Agent Spawning**: Child processes run `claude --output-format stream-json` with session ID, model, and allowed tools.

**Invariant Checking**: Composable `Checker` implementations return `Violation` objects with optional auto-corrections.

### Task Lifecycle

`pending` → `claimed` → `running` → `verifying` → `completed` (or `failed`)

### Important Files

- `packages/daemon/src/core/daemon.ts` - Main daemon orchestrator
- `packages/daemon/src/core/event-loop.ts` - Tick-based execution loop
- `packages/daemon/src/state/manager.ts` - State persistence with mutex
- `packages/daemon/src/types/state.ts` - Zod schemas for WorkflowState
- `packages/daemon/src/types/ipc.ts` - IPC request/response schemas
- `packages/dsl/src/builders/workflow.ts` - Fluent workflow builder

## DSL Usage

```typescript
import { workflow, agent, queue, compile } from '@hyh/dsl';

const orch = agent('orchestrator').model('opus');
const dev = agent('developer').model('sonnet');

const w = workflow('my-feature')
  .orchestrator(orch)
  .phase('design')
    .agent(orch)
    .expects('Read', 'Grep')
    .forbids('Write')
  .phase('implement')
    .agent(dev)
    .queue(queue('tasks'))
    .parallel(3)
  .build();

compile(w);  // Writes to .hyh/workflow.json
```

## Specifications

Detailed design documents:
- `SPEC-1-DSL.md` - DSL syntax and semantics
- `SPEC-2-RUNTIME.md` - Runtime engine behavior
- `SPEC-3-VALIDATION.md` - Invariant validation rules
