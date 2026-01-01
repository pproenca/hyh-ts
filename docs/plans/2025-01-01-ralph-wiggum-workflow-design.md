# Ralph Wiggum Workflow Design

**Date**: 2025-01-01
**Status**: Approved

## Overview

A 3-phase workflow for generating software from requirements, inspired by the [Ralph Wiggum technique](https://ghuntley.com/ralph/).

1. **Discovery** - Deep interview → progressive SPEC.md creation
2. **Refinement** - Section-by-section human review with interactive dialogue
3. **Implementation** - Wave-based TDD loop with worktree isolation

---

## Phase 1: Discovery

### Agent Configuration
- **Model**: Opus (high reasoning for nuanced interview)
- **Role**: Interviewer/Requirements Analyst
- **Tools**: Read, Grep, Glob, AskUserQuestion, Write (SPEC.md only)

### Behavior
- **Evolving mental model**: Questions build on previous answers, not checklist-driven
- **Ambiguity handling**: When answers are vague/contradictory → suggest concrete options
- **NFR coverage**: Proactively covers performance, security, scale even if user doesn't mention
- **Context storage**: Progressively append to draft SPEC.md as interview proceeds

### SPEC.md Structure (Hybrid)

Required sections:
- Goals
- Non-Goals
- Success Criteria

Dynamic sections from interview:
- Architecture
- API Design
- Data Model
- Error Handling
- Testing Strategy
- Security Considerations
- Performance Requirements
- [Additional sections as needed]

### Exit Condition
Explicit user signal (e.g., "done with interview", `/ralph-done`)

### Invariants
- `inv.noCode()` - interviewer cannot write code
- `inv.fileScope(['docs/SPEC.md'])` - can only write to spec file
- `inv.mustProgress('15m')` - must make progress within 15 minutes

---

## Phase 2: Refinement

### Agent Configuration
- **Model**: Opus
- **Role**: Spec Reviewer
- **Tools**: Read, Write (SPEC.md only), AskUserQuestion

### Behavior
For each section in SPEC.md:
1. Present section content to user
2. Ask: "Is this section complete? Any concerns?"
3. User can:
   - Confirm as-is
   - Provide feedback for changes
   - Edit directly
4. Agent incorporates feedback before moving to next section

### Iteration
- Can loop through sections multiple times
- Continues until user explicitly says "approved"

### Checkpoint
Human approval checkpoint before transitioning to Implementation

### Invariants
- `inv.fileScope(['docs/SPEC.md'])` - can only modify the spec
- `inv.mustProgress('15m')` - must make progress

---

## Phase 3: Implementation (TDD Loop)

### Agent Configuration
- **Model**: Opus
- **Role**: Implementation Engineer
- **Tools**: Read, Write, Edit, Bash(npm:*, git:*, hyh:*)

### Task Generation
- Parse SPEC.md to identify natural task boundaries
- Each task = one testable unit (inferred from spec structure)
- Tasks have dependencies based on spec order/relationships

### Parallelism Strategy
**Wave-based execution**:
- Group tasks with no file overlap into waves
- Execute each wave in parallel (worktree per task)
- Wait for wave completion before starting next wave

### Per-Task Workflow
1. Create git worktree for task
2. Write failing test (.test.ts colocated with implementation)
3. Run test → verify RED (test fails)
4. Implement minimal code to pass test
5. Run test → verify GREEN (test passes)
6. Run linter → verify clean
7. Commit changes
8. Merge worktree back to main branch

### Success Criteria
- All tests pass
- Linter clean (no errors)

### Failure Escalation
After 3 failed attempts on a task:
1. Pause the task
2. Escalate to human with full context (error, attempts, code)
3. Human provides guidance
4. Resume loop with guidance incorporated

### Invariants
- `inv.tdd({ test: '**/*.test.ts', impl: 'src/**/*.ts', order: ['test', 'impl'] })`
- `inv.fileScope(ctx => ctx.task.files)` - restricted to task's file scope

---

## Resumability

**Phase checkpoints only**:
- State persisted at phase transitions (Discovery→Refinement→Implementation)
- If interrupted mid-phase, restart that phase from beginning
- SPEC.md serves as persistent context for Discovery/Refinement phases
- Task queue state persisted for Implementation phase

---

## Observability

**Log file only**:
- All events written to `.hyh/trajectory.jsonl`
- Inspect after completion or on failure
- No real-time TUI (keeps it simple)

---

## DSL Example Location

`examples/ralph-wiggum.ts`

---

## Phase Transitions

```
┌─────────────┐     user: "done"      ┌─────────────┐
│  Discovery  │ ─────────────────────→│ Refinement  │
│  (Opus)     │                       │  (Opus)     │
└─────────────┘                       └─────────────┘
                                            │
                                            │ user: "approved"
                                            ▼
                                    ┌─────────────────┐
                                    │ Implementation  │
                                    │ (Opus, waves)   │
                                    └─────────────────┘
                                            │
                                            │ all tests pass + lint clean
                                            ▼
                                       [Complete]
```

---

## Error Handling

| Scenario | Action |
|----------|--------|
| Discovery: vague answer | Suggest concrete options |
| Refinement: user requests major change | Update section, may need to revisit dependent sections |
| Implementation: test fails 3x | Escalate to human |
| Implementation: merge conflict | Escalate to human (worktree isolation should prevent this) |
| Any phase: no progress 15min | Prompt agent or escalate |

---

## Quality Gates

Before transitioning Discovery → Refinement:
- Goals section must exist and be non-empty
- Success Criteria must be defined

Before transitioning Refinement → Implementation:
- User must explicitly approve spec
- All required sections must be complete

Before marking Implementation complete:
- All tests must pass
- Linter must be clean
- All worktrees must be merged
