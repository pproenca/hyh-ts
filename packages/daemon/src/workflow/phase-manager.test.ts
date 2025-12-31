// packages/daemon/src/workflow/phase-manager.test.ts
import { describe, it, expect } from 'vitest';
import { PhaseManager } from './phase-manager.js';

describe('PhaseManager', () => {
  it('determines if phase can transition based on outputs', () => {
    const manager = new PhaseManager({
      phases: [
        { name: 'explore', outputs: ['architecture.md'] },
        { name: 'implement', requires: ['architecture.md'] },
      ],
    });

    expect(manager.canTransition('explore', 'implement', {
      artifacts: ['architecture.md'],
    })).toBe(true);
  });

  it('blocks transition when outputs missing', () => {
    const manager = new PhaseManager({
      phases: [
        { name: 'explore', outputs: ['architecture.md'] },
        { name: 'implement', requires: ['architecture.md'] },
      ],
    });

    expect(manager.canTransition('explore', 'implement', {
      artifacts: [],
    })).toBe(false);
  });

  it('gets next phase in sequence', () => {
    const manager = new PhaseManager({
      phases: [
        { name: 'plan' },
        { name: 'implement' },
        { name: 'review' },
      ],
    });

    expect(manager.getNextPhase('plan')).toBe('implement');
    expect(manager.getNextPhase('implement')).toBe('review');
    expect(manager.getNextPhase('review')).toBeNull();
  });

  it('returns null for unknown phase', () => {
    const manager = new PhaseManager({ phases: [{ name: 'plan' }] });
    expect(manager.getNextPhase('unknown')).toBeNull();
  });
});
