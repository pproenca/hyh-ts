import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Daemon } from '../core/daemon.js';
import { WorktreeManager } from '../git/worktree.js';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('Worktree integration', () => {
  let tmpDir: string;
  let daemon: Daemon;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-worktree-'));
    await fs.mkdir(path.join(tmpDir, '.hyh'), { recursive: true });
    daemon = new Daemon({ worktreeRoot: tmpDir });
  });

  afterEach(async () => {
    await daemon.stop();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('should calculate wave for tasks based on dependencies', () => {
    const worktreeManager = new WorktreeManager(tmpDir);

    const tasks = {
      't1': { id: 't1', dependencies: [] },
      't2': { id: 't2', dependencies: ['t1'] },
      't3': { id: 't3', dependencies: ['t1', 't2'] },
    };

    expect(worktreeManager.calculateWave(tasks['t1'], tasks)).toBe(0);
    expect(worktreeManager.calculateWave(tasks['t2'], tasks)).toBe(1);
    expect(worktreeManager.calculateWave(tasks['t3'], tasks)).toBe(2);
  });
});
