# Ralph Wiggum Workflow Implementation Plan

> **Execution:** Use `/dev-workflow:execute-plan docs/plans/2025-01-01-ralph-wiggum-implementation.md` to implement task-by-task.

**Goal:** Create a complete DSL example at `examples/ralph-wiggum.ts` demonstrating a 3-phase workflow (Discovery → Refinement → Implementation) for AI-driven software generation.

**Architecture:** Single TypeScript file using the fluent DSL API. Defines 3 agents (interviewer, refiner, implementer), 2 queues (spec-sections, implementation-tasks), quality gates, and human checkpoints. Follows the pattern established in `examples/auth-workflow/workflow.ts`.

**Tech Stack:** TypeScript, @hyh/dsl package, Vitest for testing

---

## Task 1: Create Example Directory and Scaffold

**Files:**
- Create: `examples/ralph-wiggum/workflow.ts`
- Test: `examples/ralph-wiggum/workflow.test.ts`

**Step 1: Create directory structure** (30 sec)

```bash
mkdir -p examples/ralph-wiggum
```

**Step 2: Write the test file first** (3-5 min)

Create `examples/ralph-wiggum/workflow.test.ts`:

```typescript
// examples/ralph-wiggum/workflow.test.ts
import { describe, it, expect } from 'vitest';
import { compile } from '@hyh/dsl';
import { ralphWiggumWorkflow } from './workflow.js';

describe('Ralph Wiggum Workflow', () => {
  it('compiles without errors', () => {
    const compiled = compile(ralphWiggumWorkflow);
    expect(compiled.name).toBe('ralph-wiggum');
  });

  it('has four phases', () => {
    const compiled = compile(ralphWiggumWorkflow);
    expect(compiled.phases).toHaveLength(4);
    expect(compiled.phases.map(p => p.name)).toEqual([
      'discovery',
      'refinement',
      'planning',
      'implementation',
    ]);
  });

  it('has three agents', () => {
    const compiled = compile(ralphWiggumWorkflow);
    expect(Object.keys(compiled.agents)).toHaveLength(3);
    expect(compiled.agents['interviewer']).toBeDefined();
    expect(compiled.agents['refiner']).toBeDefined();
    expect(compiled.agents['implementer']).toBeDefined();
  });

  it('all agents use opus model', () => {
    const compiled = compile(ralphWiggumWorkflow);
    for (const agent of Object.values(compiled.agents)) {
      expect(agent.model).toBe('opus');
    }
  });

  it('discovery phase forbids Write and Edit', () => {
    const compiled = compile(ralphWiggumWorkflow);
    const discovery = compiled.phases.find(p => p.name === 'discovery');
    expect(discovery?.forbids).toContain('Write');
    expect(discovery?.forbids).toContain('Edit');
  });

  it('implementation phase has TDD invariant', () => {
    const compiled = compile(ralphWiggumWorkflow);
    const implementer = compiled.agents['implementer'];
    const tddInv = implementer?.invariants.find(i => i.type === 'tdd');
    expect(tddInv).toBeDefined();
  });

  it('has human checkpoints between phases', () => {
    const compiled = compile(ralphWiggumWorkflow);
    const refinement = compiled.phases.find(p => p.name === 'refinement');
    expect(refinement?.checkpoint).toBeDefined();
    expect(refinement?.checkpoint?.type).toBe('approval');
  });
});
```

**Step 3: Run test to verify it fails** (30 sec)

```bash
pnpm test examples/ralph-wiggum/workflow.test.ts
```

Expected: FAIL with `Cannot find module './workflow.js'` or similar import error

**Step 4: Create minimal workflow scaffold** (2-3 min)

Create `examples/ralph-wiggum/workflow.ts`:

```typescript
// examples/ralph-wiggum/workflow.ts
// Ralph Wiggum: A 3-phase workflow for AI-driven software generation
// 1. Discovery - Deep interview → SPEC.md
// 2. Refinement - Section-by-section human review
// 3. Implementation - Wave-based TDD loop

import {
  workflow,
  agent,
  queue,
  gate,
  inv,
  correct,
  human,
  compile,
} from '@hyh/dsl';

// Placeholder - will be implemented in next tasks
export const ralphWiggumWorkflow = workflow('ralph-wiggum')
  .build();
```

**Step 5: Run test to see specific failures** (30 sec)

```bash
pnpm test examples/ralph-wiggum/workflow.test.ts
```

Expected: FAIL with assertion errors about missing phases/agents

**Step 6: Commit scaffold** (30 sec)

```bash
git add examples/ralph-wiggum/
git commit -m "feat(examples): scaffold ralph-wiggum workflow with tests"
```

---

## Task 2: Define Agents

**Files:**
- Modify: `examples/ralph-wiggum/workflow.ts`

**Step 1: Add interviewer agent** (2-3 min)

In `workflow.ts`, after the imports, add:

```typescript
// === AGENTS ===

// Discovery: Conducts deep interview, builds evolving mental model
const interviewer = agent('interviewer')
  .model('opus')
  .role('requirements-analyst')
  .tools('Read', 'Grep', 'Glob', 'AskUserQuestion')
  .invariants(
    inv.noCode(),
    inv.mustProgress('15m')
  )
  .onViolation('noCode', correct.block('Interviewers cannot write code'))
  .onViolation('mustProgress',
    correct.prompt('Continue the interview or summarize findings.')
      .then(correct.escalate('human'))
  );

// Refinement: Reviews spec section-by-section
const refiner = agent('refiner')
  .model('opus')
  .role('spec-reviewer')
  .tools('Read', 'Write', 'AskUserQuestion')
  .invariants(
    inv.fileScope(() => ['docs/SPEC.md']),
    inv.mustProgress('15m')
  )
  .onViolation('fileScope', correct.block('Can only modify SPEC.md'));

// Implementation: TDD-based development
const implementer = agent('implementer')
  .model('opus')
  .role('implementation-engineer')
  .tools('Read', 'Write', 'Edit', 'Bash(npm:*)', 'Bash(git:*)', 'Bash(hyh:*)')
  .invariants(
    inv.tdd({
      test: '**/*.test.ts',
      impl: 'src/**/*.ts',
      order: ['test', 'impl'],
    })
  )
  .onViolation('tdd',
    correct.prompt('Write failing test before implementation.')
      .then(correct.restart())
      .then(correct.escalate('human'))
  );
```

**Step 2: Run test to verify agents are defined** (30 sec)

```bash
pnpm test examples/ralph-wiggum/workflow.test.ts
```

Expected: Still FAIL (workflow not using agents yet), but no TypeScript errors

**Step 3: Commit agents** (30 sec)

```bash
git add examples/ralph-wiggum/workflow.ts
git commit -m "feat(examples): define ralph-wiggum agents with invariants"
```

---

## Task 3: Define Queues and Gates

**Files:**
- Modify: `examples/ralph-wiggum/workflow.ts`

**Step 1: Add queues and quality gate** (2-3 min)

After the agents section, add:

```typescript
// === QUEUES ===

// Sections extracted from SPEC.md for refinement review
const specSections = queue('spec-sections')
  .timeout('30m');

// Tasks derived from SPEC.md for implementation
const implementationTasks = queue('implementation-tasks')
  .ready(task => task.deps.allComplete)
  .timeout('1h');

// === GATES ===

// Quality gate before implementation completes
const qualityGate = gate('quality')
  .requires(ctx => ctx.exec('pnpm test'))
  .requires(ctx => ctx.exec('pnpm lint'))
  .onFail(correct.retry({ max: 3 }))
  .onFailFinal(correct.escalate('human'));
```

**Step 2: Run test** (30 sec)

```bash
pnpm test examples/ralph-wiggum/workflow.test.ts
```

Expected: Still FAIL (workflow not using queues yet)

**Step 3: Commit queues and gates** (30 sec)

```bash
git add examples/ralph-wiggum/workflow.ts
git commit -m "feat(examples): add queues and quality gate for ralph-wiggum"
```

---

## Task 4: Build Complete Workflow

**Files:**
- Modify: `examples/ralph-wiggum/workflow.ts`

**Step 1: Replace placeholder workflow with full definition** (5 min)

Replace the `export const ralphWiggumWorkflow` section with:

```typescript
// === WORKFLOW ===

export const ralphWiggumWorkflow = workflow('ralph-wiggum')
  .resumable()
  .orchestrator(interviewer)

  // Phase 1: Discovery
  // Deep interview to build SPEC.md with evolving mental model
  .phase('discovery')
    .agent(interviewer)
    .expects('Read', 'Grep', 'Glob', 'AskUserQuestion')
    .forbids('Write', 'Edit')
    .output('docs/SPEC.md')
    .checkpoint(human.approval('Interview complete. Ready to refine spec?'))

  // Phase 2: Refinement
  // Section-by-section review with human feedback
  .phase('refinement')
    .agent(refiner)
    .requires('docs/SPEC.md')
    .populates(specSections)
    .checkpoint(human.approval('Spec approved. Ready to plan implementation?'))

  // Phase 3: Planning
  // Orchestrator parses SPEC.md to create implementation tasks
  .phase('planning')
    .agent(interviewer) // Reuse interviewer as planner (read-only analysis)
    .requires('docs/SPEC.md')
    .expects('Read')
    .forbids('Write', 'Edit')
    .populates(implementationTasks)

  // Phase 4: Implementation
  // Wave-based parallel TDD execution
  .phase('implementation')
    .agent(implementer)
    .queue(implementationTasks)
    .parallel()
    .gate(qualityGate)

  .build();

// Compile and export
compile(ralphWiggumWorkflow);
```

**Step 2: Run tests to verify all pass** (30 sec)

```bash
pnpm test examples/ralph-wiggum/workflow.test.ts
```

Expected: PASS (all 7 tests)

**Step 3: Run full DSL test suite to ensure no regressions** (30 sec)

```bash
pnpm test packages/dsl/
```

Expected: PASS (all existing tests still pass)

**Step 4: Commit complete workflow** (30 sec)

```bash
git add examples/ralph-wiggum/workflow.ts
git commit -m "feat(examples): complete ralph-wiggum 4-phase workflow"
```

---

## Task 5: Add Documentation Header

**Files:**
- Modify: `examples/ralph-wiggum/workflow.ts`

**Step 1: Add comprehensive documentation** (3-5 min)

At the top of the file, after the initial comment, add:

```typescript
/**
 * Ralph Wiggum Workflow
 *
 * A 4-phase workflow for AI-driven software generation, inspired by
 * https://ghuntley.com/ralph/
 *
 * ## Phases
 *
 * 1. **Discovery** - Deep interview builds SPEC.md
 *    - Interviewer asks probing questions with AskUserQuestion
 *    - Evolving mental model based on user answers
 *    - Proactively covers NFRs (performance, security, scale)
 *    - Cannot write code (inv.noCode)
 *
 * 2. **Refinement** - Section-by-section spec review
 *    - Refiner presents each section to user
 *    - User confirms, edits, or requests changes
 *    - Continues until explicit approval
 *
 * 3. **Planning** - Parse SPEC.md into tasks
 *    - Analyzes spec structure to identify task boundaries
 *    - Creates implementation task queue with dependencies
 *
 * 4. **Implementation** - Wave-based TDD loop
 *    - Tasks grouped by file overlap into waves
 *    - Each wave executes in parallel (worktree per task)
 *    - TDD invariant: test before impl
 *    - Quality gate: all tests pass + lint clean
 *
 * ## Usage
 *
 * ```bash
 * hyh run examples/ralph-wiggum/workflow.ts
 * ```
 *
 * ## Escalation
 *
 * - No progress in 15min → prompt, then escalate to human
 * - TDD violation → prompt, restart, escalate
 * - Quality gate fails 3x → escalate to human
 */
```

**Step 2: Run tests to ensure no syntax errors** (30 sec)

```bash
pnpm test examples/ralph-wiggum/workflow.test.ts
```

Expected: PASS

**Step 3: Commit documentation** (30 sec)

```bash
git add examples/ralph-wiggum/workflow.ts
git commit -m "docs(examples): add comprehensive docs to ralph-wiggum workflow"
```

---

## Task 6: Final Verification and Code Review

**Files:**
- Review: `examples/ralph-wiggum/workflow.ts`
- Review: `examples/ralph-wiggum/workflow.test.ts`

**Step 1: Run full test suite** (30 sec)

```bash
pnpm test
```

Expected: PASS (all tests across monorepo)

**Step 2: Run type check** (30 sec)

```bash
pnpm typecheck
```

Expected: PASS (no TypeScript errors)

**Step 3: Run linter** (30 sec)

```bash
pnpm lint
```

Expected: PASS or warnings only (no errors)

**Step 4: Review final file** (2 min)

```bash
cat examples/ralph-wiggum/workflow.ts
```

Verify:
- All imports used
- No placeholder comments remaining
- Documentation matches implementation
- Follows auth-workflow pattern

**Step 5: Commit any final fixes** (30 sec)

```bash
git add -A
git commit -m "chore(examples): finalize ralph-wiggum workflow"
```

---

## Parallel Groups

| Task Group | Tasks | Rationale |
|------------|-------|-----------|
| Group 1 | 1 | Scaffold setup, must complete first |
| Group 2 | 2, 3 | Agents and queues are independent definitions |
| Group 3 | 4 | Depends on agents and queues being defined |
| Group 4 | 5 | Documentation after implementation |
| Group 5 | 6 | Final verification |

---

## Success Criteria

- [ ] `examples/ralph-wiggum/workflow.ts` exists and exports `ralphWiggumWorkflow`
- [ ] `examples/ralph-wiggum/workflow.test.ts` has 7+ passing tests
- [ ] All tests pass: `pnpm test`
- [ ] TypeScript compiles: `pnpm typecheck`
- [ ] Linter clean: `pnpm lint`
- [ ] Follows DSL patterns from `examples/auth-workflow/workflow.ts`
