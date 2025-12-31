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
});

describe('correct.retry', () => {
  it('creates retry with options', () => {
    const c = correct.retry({ max: 3, backoff: 1000 });
    expect(c.type).toBe('retry');
    expect(c.max).toBe(3);
    expect(c.backoff).toBe(1000);
  });
});
