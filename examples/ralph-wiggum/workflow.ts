// examples/ralph-wiggum/workflow.ts
// Ralph Wiggum: A 4-phase workflow for AI-driven software generation
// 1. Discovery - Deep interview to understand requirements
// 2. Refinement - Section-by-section human review
// 3. Planning - Generate implementation plan
// 4. Implementation - Wave-based TDD loop

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
