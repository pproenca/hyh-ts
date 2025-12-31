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

describe('WorktreeManager wave calculation', () => {
  it('returns wave 0 for tasks with no dependencies', () => {
    const manager = new WorktreeManager('/project');
    const wave = manager.calculateWave(
      { id: 'task-1', dependencies: [] },
      {}
    );
    expect(wave).toBe(0);
  });

  it('calculates correct wave for deep dependency chains', () => {
    const manager = new WorktreeManager('/project');
    const allTasks = {
      'task-1': { id: 'task-1', dependencies: [] },
      'task-2': { id: 'task-2', dependencies: ['task-1'] },
      'task-3': { id: 'task-3', dependencies: ['task-2'] },
      'task-4': { id: 'task-4', dependencies: ['task-3'] },
    };
    const wave = manager.calculateWave(
      { id: 'task-4', dependencies: ['task-3'] },
      allTasks
    );
    expect(wave).toBe(3);
  });

  it('takes maximum wave when multiple dependencies', () => {
    const manager = new WorktreeManager('/project');
    const allTasks = {
      'task-1': { id: 'task-1', dependencies: [] },
      'task-2': { id: 'task-2', dependencies: [] },
      'task-3': { id: 'task-3', dependencies: ['task-1'] },
    };
    // task-4 depends on task-2 (wave 0) and task-3 (wave 1)
    const wave = manager.calculateWave(
      { id: 'task-4', dependencies: ['task-2', 'task-3'] },
      allTasks
    );
    expect(wave).toBe(2); // max(0, 1) + 1 = 2
  });
});

describe('WorktreeManager path generation', () => {
  it('generates consistent path format', () => {
    const manager = new WorktreeManager('/home/user/project');
    expect(manager.getWorktreePath(0)).toBe('/home/user/project--wave-0');
    expect(manager.getWorktreePath(5)).toBe('/home/user/project--wave-5');
  });
});
