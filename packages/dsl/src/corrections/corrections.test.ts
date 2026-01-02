// packages/dsl/src/corrections/corrections.test.ts
import { describe, it, expect } from 'vitest';
import { correct } from './index.js';

describe('correct.prompts', () => {
  it('creates prompt correction', () => {
    const c = correct.prompts('Write tests first.');
    expect(c.type).toBe('prompt');
    expect(c.message).toBe('Write tests first.');
  });
});

describe('correct.warns', () => {
  it('creates warn correction with message', () => {
    const c = correct.warns('This is a soft warning');
    expect(c.type).toBe('warn');
    expect(c.message).toBe('This is a soft warning');
  });
});

describe('correct.blocks', () => {
  it('creates block correction without message', () => {
    const c = correct.blocks();
    expect(c.type).toBe('block');
    expect(c.message).toBeUndefined();
  });

  it('creates block correction with message', () => {
    const c = correct.blocks('Operation blocked due to policy violation');
    expect(c.type).toBe('block');
    expect(c.message).toBe('Operation blocked due to policy violation');
  });
});

describe('correct.restarts', () => {
  it('creates restart correction', () => {
    const c = correct.restarts();
    expect(c.type).toBe('restart');
  });
});

describe('correct.reassigns', () => {
  it('creates reassign correction', () => {
    const c = correct.reassigns();
    expect(c.type).toBe('reassign');
  });
});

describe('correct.escalates', () => {
  it('creates escalate to orchestrator', () => {
    const c = correct.escalates('orchestrator');
    expect(c.type).toBe('escalate');
    expect(c.to).toBe('orchestrator');
  });

  it('creates escalate to human', () => {
    const c = correct.escalates('human');
    expect(c.type).toBe('escalate');
    expect(c.to).toBe('human');
  });
});

describe('correct.compacts', () => {
  it('creates compact correction with preserve types', () => {
    const c = correct.compacts({ preserve: ['errors', 'decisions'] });
    expect(c.type).toBe('compact');
    expect(c.preserveTypes).toEqual(['errors', 'decisions']);
  });

  it('creates compact correction with preserve and discard', () => {
    const c = correct.compacts({
      preserve: ['errors'],
      discard: ['verbose_logs'],
    });
    expect(c.type).toBe('compact');
    expect(c.preserveTypes).toEqual(['errors']);
  });
});

describe('correct chaining with .otherwise', () => {
  it('chains corrections with otherwise', () => {
    const c = correct
      .prompts('Fix the issue.')
      .otherwise.restarts()
      .otherwise.escalates('orchestrator');

    expect(c.type).toBe('prompt');
    expect(c.then?.type).toBe('restart');
    expect(c.then?.then?.type).toBe('escalate');
    expect(c.then?.then?.to).toBe('orchestrator');
  });

  it('chains warn with block', () => {
    const c = correct.warns('First warning').otherwise.blocks('Final block');
    expect(c.type).toBe('warn');
    expect(c.then?.type).toBe('block');
    expect(c.then?.message).toBe('Final block');
  });

  it('chains retry with escalate', () => {
    const c = correct.retries({ max: 3 }).otherwise.escalates('human');
    expect(c.type).toBe('retry');
    expect(c.max).toBe(3);
    expect(c.then?.type).toBe('escalate');
    expect(c.then?.to).toBe('human');
  });
});

describe('correct.retries', () => {
  it('creates retry with options', () => {
    const c = correct.retries({ max: 3, backoff: 1000 });
    expect(c.type).toBe('retry');
    expect(c.max).toBe(3);
    expect(c.backoff).toBe(1000);
  });

  it('creates retry without backoff', () => {
    const c = correct.retries({ max: 5 });
    expect(c.type).toBe('retry');
    expect(c.max).toBe(5);
    expect(c.backoff).toBeUndefined();
  });
});
