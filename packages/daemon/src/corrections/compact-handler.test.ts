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
