// packages/dsl/src/corrections/corrections.test.ts
import { describe, it, expect } from 'vitest';
import { correct } from './index.js';

describe('correct.prompt', () => {
  it('creates prompt correction', () => {
    const c = correct.prompt('Write tests first.');
    expect(c.type).toBe('prompt');
    expect(c.message).toBe('Write tests first.');
  });
});

describe('correct.warn', () => {
  it('creates warn correction with message', () => {
    const c = correct.warn('This is a soft warning');
    expect(c.type).toBe('warn');
    expect(c.message).toBe('This is a soft warning');
  });
});

describe('correct.block', () => {
  it('creates block correction without message', () => {
    const c = correct.block();
    expect(c.type).toBe('block');
    expect(c.message).toBeUndefined();
  });

  it('creates block correction with message', () => {
    const c = correct.block('Operation blocked due to policy violation');
    expect(c.type).toBe('block');
    expect(c.message).toBe('Operation blocked due to policy violation');
  });
});

describe('correct.restart', () => {
  it('creates restart correction', () => {
    const c = correct.restart();
    expect(c.type).toBe('restart');
  });
});

describe('correct.reassign', () => {
  it('creates reassign correction', () => {
    const c = correct.reassign();
    expect(c.type).toBe('reassign');
  });
});

describe('correct.escalate', () => {
  it('creates escalate to orchestrator', () => {
    const c = correct.escalate('orchestrator');
    expect(c.type).toBe('escalate');
    expect(c.to).toBe('orchestrator');
  });

  it('creates escalate to human', () => {
    const c = correct.escalate('human');
    expect(c.type).toBe('escalate');
    expect(c.to).toBe('human');
  });
});

describe('correct.compact', () => {
  it('creates compact correction with preserve types', () => {
    const c = correct.compact({ preserve: ['errors', 'decisions'] });
    expect(c.type).toBe('compact');
    expect(c.preserveTypes).toEqual(['errors', 'decisions']);
  });

  it('creates compact correction with preserve and discard', () => {
    const c = correct.compact({
      preserve: ['errors'],
      discard: ['verbose_logs'],
    });
    expect(c.type).toBe('compact');
    expect(c.preserveTypes).toEqual(['errors']);
  });
});

describe('correct chaining', () => {
  it('chains corrections with then()', () => {
    const c = correct
      .prompt('Fix the issue.')
      .then(correct.restart())
      .then(correct.escalate('orchestrator'));

    expect(c.type).toBe('prompt');
    expect(c.then?.type).toBe('restart');
    expect(c.then?.then?.type).toBe('escalate');
    expect(c.then?.then?.to).toBe('orchestrator');
  });

  it('chains warn with block', () => {
    const c = correct.warn('First warning').then(correct.block('Final block'));
    expect(c.type).toBe('warn');
    expect(c.then?.type).toBe('block');
    expect(c.then?.message).toBe('Final block');
  });

  it('chains retry with escalate', () => {
    const c = correct.retry({ max: 3 }).then(correct.escalate('human'));
    expect(c.type).toBe('retry');
    expect(c.max).toBe(3);
    expect(c.then?.type).toBe('escalate');
    expect(c.then?.to).toBe('human');
  });
});

describe('correct.retry', () => {
  it('creates retry with options', () => {
    const c = correct.retry({ max: 3, backoff: 1000 });
    expect(c.type).toBe('retry');
    expect(c.max).toBe(3);
    expect(c.backoff).toBe(1000);
  });

  it('creates retry without backoff', () => {
    const c = correct.retry({ max: 5 });
    expect(c.type).toBe('retry');
    expect(c.max).toBe(5);
    expect(c.backoff).toBeUndefined();
  });
});
