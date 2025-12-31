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

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker',
      tool: 'Read',
    };
    checker.check(event, { agentId: 'worker', event, state: {} });

    expect(checker['lastActivity']).toBeGreaterThan(oldTime);
  });

  it('only applies to specified agent', () => {
    const checker = new MustProgressChecker('worker', 60000);
    expect(checker.appliesTo('worker', {})).toBe(true);
    expect(checker.appliesTo('orchestrator', {})).toBe(false);
  });
});

describe('MustProgressChecker checkTimeout', () => {
  it('returns violation when timed out', () => {
    const checker = new MustProgressChecker('worker', 100);
    checker['lastActivity'] = Date.now() - 200;

    const violation = checker.checkTimeout();

    expect(violation).not.toBeNull();
    expect(violation!.type).toBe('mustProgress');
  });

  it('includes elapsed time in violation message', () => {
    const checker = new MustProgressChecker('worker', 100);
    checker['lastActivity'] = Date.now() - 5000;

    const violation = checker.checkTimeout();

    expect(violation).not.toBeNull();
    expect(violation!.message).toContain('5');
  });

  it('includes timeout threshold in violation message', () => {
    const checker = new MustProgressChecker('worker', 60000);
    checker['lastActivity'] = Date.now() - 70000;

    const violation = checker.checkTimeout();

    expect(violation).not.toBeNull();
    expect(violation!.message).toContain('60');
  });
});

describe('MustProgressChecker recordActivity', () => {
  it('updates last activity timestamp', () => {
    const checker = new MustProgressChecker('worker', 60000);
    const before = checker['lastActivity'];

    // Wait a bit then record
    checker.recordActivity();
    const after = checker['lastActivity'];

    expect(after).toBeGreaterThanOrEqual(before);
  });
});

describe('MustProgressChecker check method', () => {
  it('returns null on check (activity is implicit)', () => {
    const checker = new MustProgressChecker('worker', 60000);

    const event = {
      type: 'tool_use' as const,
      timestamp: Date.now(),
      agentId: 'worker',
      tool: 'Write',
    };

    const result = checker.check(event, {
      agentId: 'worker',
      event,
      state: {},
    });

    // check() returns null because timeout violations are detected via checkTimeout()
    expect(result).toBeNull();
  });

  it('does not record activity for non-tool events', () => {
    const checker = new MustProgressChecker('worker', 60000);
    const oldTime = Date.now() - 50000;
    checker['lastActivity'] = oldTime;

    const event = {
      type: 'message' as const,
      timestamp: Date.now(),
      agentId: 'worker',
      content: 'Hello',
    };

    checker.check(event, { agentId: 'worker', event, state: {} });

    // Activity should not update for non-tool events
    expect(checker['lastActivity']).toBe(oldTime);
  });
});
