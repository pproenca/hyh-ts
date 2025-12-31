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

describe('PhaseManager transition requirements', () => {
  it('allows transition when all requires are met', () => {
    const manager = new PhaseManager({
      phases: [
        { name: 'design', outputs: ['design.md', 'api.md'] },
        { name: 'build', requires: ['design.md', 'api.md'] },
      ],
    });

    expect(manager.canTransition('design', 'build', {
      artifacts: ['design.md', 'api.md'],
    })).toBe(true);
  });

  it('blocks transition when some requires are missing', () => {
    const manager = new PhaseManager({
      phases: [
        { name: 'design', outputs: ['design.md', 'api.md'] },
        { name: 'build', requires: ['design.md', 'api.md'] },
      ],
    });

    expect(manager.canTransition('design', 'build', {
      artifacts: ['design.md'], // api.md missing
    })).toBe(false);
  });

  it('allows transition when phase has no requires', () => {
    const manager = new PhaseManager({
      phases: [
        { name: 'start' },
        { name: 'work' },
      ],
    });

    expect(manager.canTransition('start', 'work', {
      artifacts: [],
    })).toBe(true);
  });

  it('blocks transition to unknown phase', () => {
    const manager = new PhaseManager({
      phases: [{ name: 'plan' }],
    });

    expect(manager.canTransition('plan', 'unknown', {
      artifacts: [],
    })).toBe(false);
  });
});

describe('PhaseManager phase sequence', () => {
  it('handles single phase workflow', () => {
    const manager = new PhaseManager({
      phases: [{ name: 'only' }],
    });

    expect(manager.getNextPhase('only')).toBeNull();
  });

  it('handles empty phases array', () => {
    const manager = new PhaseManager({ phases: [] });
    expect(manager.getNextPhase('any')).toBeNull();
  });

  it('navigates through all phases', () => {
    const manager = new PhaseManager({
      phases: [
        { name: 'phase1' },
        { name: 'phase2' },
        { name: 'phase3' },
        { name: 'phase4' },
      ],
    });

    let current: string | null = 'phase1';
    const visited: string[] = [current];

    while ((current = manager.getNextPhase(current)) !== null) {
      visited.push(current);
    }

    expect(visited).toEqual(['phase1', 'phase2', 'phase3', 'phase4']);
  });
});
