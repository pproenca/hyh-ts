// packages/daemon/src/corrections/applicator.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CorrectionApplicator } from './applicator.js';

describe('CorrectionApplicator', () => {
  it('applies prompt correction by injecting message', async () => {
    const injectPrompt = vi.fn();
    const applicator = new CorrectionApplicator({
      injectPrompt,
      killAgent: vi.fn(),
      respawnAgent: vi.fn(),
      reassignTask: vi.fn(),
      compactContext: vi.fn(),
    });

    await applicator.apply('worker-1', {
      type: 'prompt',
      message: 'Write tests first.',
    });

    expect(injectPrompt).toHaveBeenCalledWith('worker-1', expect.stringContaining('Write tests first'));
  });

  it('applies block correction', async () => {
    const injectPrompt = vi.fn();
    const applicator = new CorrectionApplicator({
      injectPrompt,
      killAgent: vi.fn(),
      respawnAgent: vi.fn(),
      reassignTask: vi.fn(),
      compactContext: vi.fn(),
    });

    const result = await applicator.apply('worker-1', {
      type: 'block',
      message: 'Action blocked',
    });

    expect(result.blocked).toBe(true);
  });

  it('applies warn correction without blocking', async () => {
    const injectPrompt = vi.fn();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const applicator = new CorrectionApplicator({
      injectPrompt,
      killAgent: vi.fn(),
      respawnAgent: vi.fn(),
      reassignTask: vi.fn(),
      compactContext: vi.fn(),
    });

    const result = await applicator.apply('worker-1', {
      type: 'warn',
      message: 'Warning message',
    });

    expect(result.blocked).toBe(false);
    warnSpy.mockRestore();
  });

  it('applies restart correction by killing and respawning agent', async () => {
    const killAgent = vi.fn().mockResolvedValue(undefined);
    const respawnAgent = vi.fn().mockResolvedValue(undefined);

    const applicator = new CorrectionApplicator({
      injectPrompt: vi.fn(),
      killAgent,
      respawnAgent,
      reassignTask: vi.fn(),
      compactContext: vi.fn(),
    });

    await applicator.apply('agent-1', { type: 'restart' });

    expect(killAgent).toHaveBeenCalledWith('agent-1');
    expect(respawnAgent).toHaveBeenCalledWith('agent-1');
  });

  it('applies compact correction with config options', async () => {
    const compactContext = vi.fn().mockResolvedValue(undefined);

    const applicator = new CorrectionApplicator({
      injectPrompt: vi.fn(),
      killAgent: vi.fn(),
      respawnAgent: vi.fn(),
      reassignTask: vi.fn(),
      compactContext,
    });

    await applicator.apply('agent-1', {
      type: 'compact',
      keepLastN: 50,
      summarize: true,
    });

    expect(compactContext).toHaveBeenCalledWith('agent-1', {
      keepLastN: 50,
      summarize: true,
    });
  });

  it('applies reassign correction', async () => {
    const reassignTask = vi.fn().mockResolvedValue(undefined);

    const applicator = new CorrectionApplicator({
      injectPrompt: vi.fn(),
      killAgent: vi.fn(),
      respawnAgent: vi.fn(),
      reassignTask,
      compactContext: vi.fn(),
    });

    await applicator.apply('agent-1', { type: 'reassign' });

    expect(reassignTask).toHaveBeenCalledWith('agent-1');
  });
});
