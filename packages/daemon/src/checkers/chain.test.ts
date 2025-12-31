// packages/daemon/src/checkers/chain.test.ts
import { describe, it, expect } from 'vitest';
import { CheckerChain } from './chain.js';
import type { Checker } from './types.js';
import type { CompiledWorkflow } from '@hyh/dsl';

describe('CheckerChain', () => {
  it('runs checkers and returns first violation', () => {
    const passingChecker: Checker = {
      name: 'passing',
      appliesTo: () => true,
      check: () => null,
    };

    const failingChecker: Checker = {
      name: 'failing',
      appliesTo: () => true,
      check: () => ({
        type: 'test_violation',
        message: 'Test failed',
        agentId: 'agent-1',
      }),
    };

    const chain = new CheckerChain([passingChecker, failingChecker]);

    const event = { type: 'tool_use' as const, tool: 'Write', timestamp: Date.now(), agentId: 'agent-1' };
    const result = chain.check('agent-1', event, {});

    expect(result).not.toBeNull();
    expect(result!.type).toBe('test_violation');
  });

  it('returns null when no violations', () => {
    const passingChecker: Checker = {
      name: 'passing',
      appliesTo: () => true,
      check: () => null,
    };

    const chain = new CheckerChain([passingChecker]);

    const event = { type: 'tool_use' as const, tool: 'Read', timestamp: Date.now(), agentId: 'agent-1' };
    const result = chain.check('agent-1', event, {});

    expect(result).toBeNull();
  });

  it('skips checkers that do not apply', () => {
    const nonApplicableChecker: Checker = {
      name: 'non-applicable',
      appliesTo: () => false,
      check: () => ({
        type: 'should_not_happen',
        message: 'This should not be returned',
        agentId: 'agent-1',
      }),
    };

    const chain = new CheckerChain([nonApplicableChecker]);

    const event = { type: 'tool_use' as const, tool: 'Read', timestamp: Date.now(), agentId: 'agent-1' };
    const result = chain.check('agent-1', event, {});

    expect(result).toBeNull();
  });

  it('adds checker dynamically', () => {
    const chain = new CheckerChain([]);

    const checker: Checker = {
      name: 'dynamic',
      appliesTo: () => true,
      check: () => ({
        type: 'dynamic_violation',
        message: 'Dynamic check failed',
        agentId: 'agent-1',
      }),
    };

    chain.addChecker(checker);

    const event = { type: 'message' as const, content: 'test', timestamp: Date.now(), agentId: 'agent-1' };
    const result = chain.check('agent-1', event, {});

    expect(result).not.toBeNull();
    expect(result!.type).toBe('dynamic_violation');
  });
});

describe('CheckerChain with new checkers', () => {
  it('builds chain from workflow with all invariant types', () => {
    const workflow: CompiledWorkflow = {
      name: 'test',
      resumable: false,
      orchestrator: 'orchestrator',
      agents: {
        worker: {
          name: 'worker',
          model: 'sonnet',
          role: 'implementation',
          tools: ['Read', 'Write'],
          invariants: [
            { type: 'tdd', options: { test: '**/*.test.ts', impl: 'src/**/*.ts' } },
            { type: 'fileScope', options: { getter: '["src/auth.ts"]' } },
            { type: 'externalTodo', options: { file: 'todo.md', checkBeforeStop: true } },
            { type: 'contextLimit', options: { max: 0.8, warn: 0.6 } },
          ],
          spawns: [],
          violations: {},
          systemPrompt: '',
        },
      },
      phases: [{
        name: 'implement',
        agent: 'worker',
        expects: ['Read', 'Write'],
        forbids: ['Bash'],
        outputs: [],
        requires: [],
        parallel: false,
      }],
      queues: {},
      gates: {},
    };

    const chain = CheckerChain.fromWorkflow(workflow);
    expect(chain.checkerCount).toBeGreaterThanOrEqual(5); // tdd, fileScope, todo, context, phase
  });
});
