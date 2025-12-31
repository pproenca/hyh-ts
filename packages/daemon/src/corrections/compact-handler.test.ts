// packages/daemon/src/corrections/compact-handler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CompactHandler } from './compact-handler.js';

describe('CompactHandler', () => {
  it('should preserve specified message types', async () => {
    const messages = [
      { role: 'user', content: 'explore the codebase' },
      { role: 'assistant', content: 'I found these files...' },
      { role: 'user', content: 'now implement feature X' },
      { role: 'assistant', content: 'Here is the implementation decision...' },
    ];

    const handler = new CompactHandler({
      preserve: ['decisions', 'interfaces'],
      summarize: ['exploration'],
      discard: ['verbose-output'],
    });

    const result = await handler.compact(messages);

    expect(result.length).toBeLessThan(messages.length);
    expect(result.some(m => m.content.includes('decision'))).toBe(true);
  });

  it('should call preCompact hook if provided', async () => {
    const preCompactHook = vi.fn().mockResolvedValue({
      preserved: ['key decision'],
      discarded: 2,
    });

    const handler = new CompactHandler({
      preCompact: preCompactHook,
    });

    await handler.compact([{ role: 'user', content: 'test' }]);

    expect(preCompactHook).toHaveBeenCalled();
  });
});

describe('CompactHandler preserve patterns', () => {
  it('preserves messages containing "decisions"', async () => {
    const handler = new CompactHandler();
    const messages = [
      { role: 'assistant', content: 'My decisions are to use pattern X' },
      { role: 'user', content: 'ok' },
    ];

    const result = await handler.compact(messages);

    expect(result.some(m => m.content.includes('decisions'))).toBe(true);
  });

  it('preserves messages containing "interfaces"', async () => {
    const handler = new CompactHandler();
    const messages = [
      { role: 'assistant', content: 'The interfaces defined are IUser and IAuth' },
      { role: 'user', content: 'ok' },
    ];

    const result = await handler.compact(messages);

    expect(result.some(m => m.content.includes('interfaces'))).toBe(true);
  });

  it('preserves messages containing "blockers"', async () => {
    const handler = new CompactHandler();
    const messages = [
      { role: 'assistant', content: 'There are blockers preventing progress' },
      { role: 'user', content: 'understood' },
    ];

    const result = await handler.compact(messages);

    expect(result.some(m => m.content.includes('blockers'))).toBe(true);
  });
});

describe('CompactHandler fallback behavior', () => {
  it('keeps last message when nothing matches', async () => {
    const handler = new CompactHandler({ preserve: ['xyz'] });
    const messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'world' },
    ];

    const result = await handler.compact(messages);

    expect(result.length).toBe(1);
    expect(result[0]?.content).toBe('world');
  });

  it('returns empty array for empty input', async () => {
    const handler = new CompactHandler();
    const result = await handler.compact([]);

    expect(result).toEqual([]);
  });
});

describe('CompactHandler custom patterns', () => {
  it('uses custom preserve patterns', async () => {
    const handler = new CompactHandler({
      preserve: ['important', 'critical'],
    });

    const messages = [
      { role: 'assistant', content: 'This is important stuff' },
      { role: 'assistant', content: 'This is not relevant' },
      { role: 'assistant', content: 'This is critical info' },
    ];

    const result = await handler.compact(messages);

    expect(result).toHaveLength(2);
    expect(result[0]?.content).toContain('important');
    expect(result[1]?.content).toContain('critical');
  });
});
