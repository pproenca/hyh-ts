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
 *    - Cannot write code (rule.noCode)
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

import {
  workflow,
  agent,
  queue,
  gate,
  compile,
} from '@hyh/dsl';

// === AGENTS ===

// Discovery: Conducts deep interview, builds evolving mental model
const interviewer = agent('interviewer')
  .model('opus')
  .role('requirements-analyst')
  .tools('Read', 'Grep', 'Glob', 'AskUserQuestion')
  .rules(rule => [
    rule.noCode()
      .blocks('Interviewers cannot write code'),
    rule.mustProgress('15m')
      .prompts('Continue the interview or summarize findings.')
      .otherwise.escalates('human')
  ]);

// Refinement: Reviews spec section-by-section
const refiner = agent('refiner')
  .model('opus')
  .role('spec-reviewer')
  .tools('Read', 'Write', 'AskUserQuestion')
  .rules(rule => [
    rule.fileScope(() => ['docs/SPEC.md'])
      .blocks('Can only modify SPEC.md'),
    rule.mustProgress('15m')
  ]);

// Implementation: TDD-based development
const implementer = agent('implementer')
  .model('opus')
  .role('implementation-engineer')
  .tools('Read', 'Write', 'Edit', 'Bash(npm:*)', 'Bash(git:*)', 'Bash(hyh:*)')
  .rules(rule => [
    rule.tdd({
      test: '**/*.test.ts',
      impl: 'src/**/*.ts',
      order: ['test', 'impl'],
    })
      .prompts('Write failing test before implementation.')
      .otherwise.restarts()
      .otherwise.escalates('human')
  ]);

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
    .retries({ max: 3 })
    .otherwise.escalates('human')
  .requires(ctx => ctx.exec('pnpm lint'))
    .retries({ max: 2 })
    .otherwise.blocks('Lint must pass');

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
    .checkpoint(actor => actor.human.approval('Interview complete. Ready to refine spec?'))

  // Phase 2: Refinement
  // Section-by-section review with human feedback
  .phase('refinement')
    .agent(refiner)
    .requires('docs/SPEC.md')
    .populates(specSections)
    .checkpoint(actor => actor.human.approval('Spec approved. Ready to plan implementation?'))

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
