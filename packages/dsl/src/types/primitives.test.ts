// packages/dsl/src/types/primitives.test.ts
import { describe, it, expect } from 'vitest';
import { parseDuration, Duration } from './primitives.js';

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30000);
  });

  it('parses minutes', () => {
    expect(parseDuration('10m')).toBe(600000);
  });

  it('parses hours', () => {
    expect(parseDuration('2h')).toBe(7200000);
  });

  it('passes through milliseconds as number', () => {
    expect(parseDuration(5000)).toBe(5000);
  });

  it('throws on invalid format', () => {
    expect(() => parseDuration('10x' as Duration)).toThrow('Invalid duration');
  });
});
