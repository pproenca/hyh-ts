import { describe, it, expect } from 'vitest';
import { WorktreeManager } from './worktree.js';

describe('WorktreeManager', () => {
  it('generates worktree path for wave', () => {
    const manager = new WorktreeManager('/project');
    const path = manager.getWorktreePath(1);
    expect(path).toBe('/project--wave-1');
  });

  it('calculates wave from task dependencies', () => {
    const manager = new WorktreeManager('/project');
    const wave = manager.calculateWave({
      id: 'task-3',
      dependencies: ['task-1', 'task-2'],
    }, {
      'task-1': { id: 'task-1', dependencies: [] },
      'task-2': { id: 'task-2', dependencies: ['task-1'] },
    });
    expect(wave).toBe(2); // task-2 is wave 1, so task-3 is wave 2
  });
});
