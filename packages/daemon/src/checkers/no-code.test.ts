// packages/daemon/src/checkers/no-code.test.ts
import { describe, it, expect } from 'vitest';
import { NoCodeChecker } from './no-code.js';

describe('NoCodeChecker', () => {
  it('allows Read operations', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Read',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).toBeNull();
  });

  it('blocks Write to code files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Write',
      path: 'src/foo.ts',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('noCode');
  });

  it('allows Write to markdown files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Write',
      path: 'docs/plan.md',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).toBeNull();
  });

  it('only applies to specified agent', () => {
    const checker = new NoCodeChecker('orchestrator');
    expect(checker.appliesTo('orchestrator', {})).toBe(true);
    expect(checker.appliesTo('worker', {})).toBe(false);
  });
});

describe('NoCodeChecker file types', () => {
  it('blocks Write to JavaScript files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Write',
      path: 'src/component.js',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).not.toBeNull();
  });

  it('blocks Write to Python files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Write',
      path: 'scripts/main.py',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).not.toBeNull();
  });

  it('allows Write to text files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Write',
      path: 'docs/notes.txt',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).toBeNull();
  });

  it('allows Write to JSON config files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Write',
      path: 'config.json',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).toBeNull();
  });
});

describe('NoCodeChecker Edit tool', () => {
  it('blocks Edit to code files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Edit',
      path: 'src/feature.ts',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('noCode');
  });

  it('allows Edit to markdown files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Edit',
      path: 'README.md',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).toBeNull();
  });
});

describe('NoCodeChecker non-write tools', () => {
  it('allows Grep operations', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Grep',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).toBeNull();
  });

  it('allows Glob operations', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Glob',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).toBeNull();
  });

  it('allows Bash operations', () => {
    const checker = new NoCodeChecker('orchestrator');
    const event = {
      type: 'tool_use' as const,
      tool: 'Bash',
      timestamp: Date.now(),
      agentId: 'orchestrator',
    };
    const violation = checker.check(event, { agentId: 'orchestrator', event, state: {} });

    expect(violation).toBeNull();
  });
});
