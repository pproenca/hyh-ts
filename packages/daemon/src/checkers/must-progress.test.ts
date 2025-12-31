// packages/daemon/src/checkers/must-progress.test.ts
import { describe, it, expect } from 'vitest';
import { MustProgressChecker } from './must-progress.js';

describe('MustProgressChecker', () => {
  it('allows activity within timeout', () => {
    const checker = new MustProgressChecker('worker', 60000);
    checker.recordActivity();

    const violation = checker.checkTimeout();
    expect(violation).toBeNull();
  });

  it('detects timeout after inactivity', () => {
    const checker = new MustProgressChecker('worker', 100);
    // Simulate time passing without activity
    checker['lastActivity'] = Date.now() - 200;

    const violation = checker.checkTimeout();
    expect(violation).not.toBeNull();
    expect(violation?.type).toBe('mustProgress');
  });

  it('records activity on tool use events', () => {
    const checker = new MustProgressChecker('worker', 60000);
    const oldTime = Date.now() - 50000;
    checker['lastActivity'] = oldTime;

    checker.check({
      type: 'tool_use',
      timestamp: Date.now(),
    }, { agentId: 'worker', event: {}, state: {} });

    expect(checker['lastActivity']).toBeGreaterThan(oldTime);
  });

  it('only applies to specified agent', () => {
    const checker = new MustProgressChecker('worker', 60000);
    expect(checker.appliesTo('worker', {})).toBe(true);
    expect(checker.appliesTo('orchestrator', {})).toBe(false);
  });
});
