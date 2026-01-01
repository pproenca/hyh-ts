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

// Placeholder - will be implemented in next tasks
export const ralphWiggumWorkflow = workflow('ralph-wiggum')
  .build();
