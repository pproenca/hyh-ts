// packages/daemon/src/checkers/no-code.test.ts
import { describe, it, expect } from 'vitest';
import { NoCodeChecker } from './no-code.js';

describe('NoCodeChecker', () => {
  it('allows Read operations', () => {
    const checker = new NoCodeChecker('orchestrator');
    const violation = checker.check({
      type: 'tool_use',
      tool: 'Read',
      timestamp: Date.now(),
    }, { agentId: 'orchestrator', event: {} as any, state: {} });

    expect(violation).toBeNull();
  });

  it('blocks Write to code files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const violation = checker.check({
      type: 'tool_use',
      tool: 'Write',
      path: 'src/foo.ts',
      timestamp: Date.now(),
    }, { agentId: 'orchestrator', event: {} as any, state: {} });

    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('noCode');
  });

  it('allows Write to markdown files', () => {
    const checker = new NoCodeChecker('orchestrator');
    const violation = checker.check({
      type: 'tool_use',
      tool: 'Write',
      path: 'docs/plan.md',
      timestamp: Date.now(),
    }, { agentId: 'orchestrator', event: {} as any, state: {} });

    expect(violation).toBeNull();
  });

  it('only applies to specified agent', () => {
    const checker = new NoCodeChecker('orchestrator');
    expect(checker.appliesTo('orchestrator', {})).toBe(true);
    expect(checker.appliesTo('worker', {})).toBe(false);
  });
});
