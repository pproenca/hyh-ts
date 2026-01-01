# Auth Workflow Example

A multi-phase workflow demonstrating hyh orchestration with TDD enforcement.

## Overview

This example shows a realistic workflow for implementing an authentication feature:

- **Phases:** plan → implement → verify
- **Agents:** orchestrator (Opus), developer (Sonnet)
- **Features:** Parallel workers (2), TDD enforcement

## Workflow Structure

```
┌─────────────────────────────────────────────────────────┐
│  Phase: plan                                            │
│  Agent: orchestrator (opus)                             │
│  Tools: Read, Grep, Glob (Write/Edit forbidden)        │
│  Output: populates implementation-tasks queue           │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Phase: implement                                       │
│  Agent: developer (sonnet) x2 parallel                  │
│  Queue: implementation-tasks                            │
│  Invariant: TDD (test files must be written first)      │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│  Phase: verify                                          │
│  Agent: orchestrator (opus)                             │
│  Tools: Bash (for running tests)                        │
└─────────────────────────────────────────────────────────┘
```

## Usage

1. From the repository root, compile the workflow:
   ```bash
   hyh compile examples/auth-workflow/workflow.ts
   ```

2. Run the workflow:
   ```bash
   hyh run
   ```

3. Monitor status:
   ```bash
   hyh status
   ```

## Files Generated

After `hyh compile`:
- `.hyh/workflow.json` - Compiled workflow definition
- `.hyh/state.json` - Runtime state (created during run)
- `.hyh/trajectory.jsonl` - Event log (created during run)

## Key Features Demonstrated

### TDD Enforcement
The developer agent has a TDD invariant that requires test files (`**/*.test.ts`) to be written before implementation files (`**/!(*.test).ts`).

### Phase Gating
- **plan** phase: Read-only exploration, forbidden from writing files
- **implement** phase: Consumes tasks from queue, runs in parallel
- **verify** phase: Final verification using bash commands

### Parallel Execution
Two developer agents work simultaneously on tasks from the queue, maximizing throughput while the TDD checker ensures code quality.
