// packages/daemon/src/corrections/applicator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CorrectionApplicator } from './applicator.js';

describe('CorrectionApplicator', () => {
  it('applies prompt correction by injecting message', async () => {
    const injectPrompt = vi.fn();
    const applicator = new CorrectionApplicator({ injectPrompt });

    await applicator.apply('worker-1', {
      type: 'prompt',
      message: 'Write tests first.',
    });

    expect(injectPrompt).toHaveBeenCalledWith('worker-1', expect.stringContaining('Write tests first'));
  });

  it('applies block correction', async () => {
    const injectPrompt = vi.fn();
    const applicator = new CorrectionApplicator({ injectPrompt });

    const result = await applicator.apply('worker-1', {
      type: 'block',
      message: 'Action blocked',
    });

    expect(result.blocked).toBe(true);
  });

  it('applies warn correction without blocking', async () => {
    const injectPrompt = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const applicator = new CorrectionApplicator({ injectPrompt });

    const result = await applicator.apply('worker-1', {
      type: 'warn',
      message: 'Warning message',
    });

    expect(result.blocked).toBe(false);
    warnSpy.mockRestore();
  });

  it('applies restart correction by killing agent', async () => {
    const injectPrompt = vi.fn();
    const killAgent = vi.fn();
    const applicator = new CorrectionApplicator({ injectPrompt, killAgent });

    const result = await applicator.apply('worker-1', {
      type: 'restart',
    });

    expect(killAgent).toHaveBeenCalledWith('worker-1');
    expect(result.blocked).toBe(true);
  });
});
