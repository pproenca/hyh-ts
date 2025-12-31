import { execSync } from 'node:child_process';

interface TaskDep {
  id: string;
  dependencies: string[];
}

export class WorktreeManager {
  private readonly mainRepo: string;

  constructor(mainRepo: string) {
    this.mainRepo = mainRepo;
  }

  getWorktreePath(wave: number): string {
    return `${this.mainRepo}--wave-${wave}`;
  }

  calculateWave(task: TaskDep, allTasks: Record<string, TaskDep>): number {
    if (task.dependencies.length === 0) return 0;

    let maxDepWave = 0;
    for (const depId of task.dependencies) {
      const depTask = allTasks[depId];
      if (depTask) {
        const depWave = this.calculateWave(depTask, allTasks);
        maxDepWave = Math.max(maxDepWave, depWave);
      }
    }
    return maxDepWave + 1;
  }

  async create(branch: string): Promise<string> {
    const worktreePath = `${this.mainRepo}--${branch}`;
    execSync(`git -C ${this.mainRepo} worktree add -b ${branch} ${worktreePath}`, {
      encoding: 'utf-8',
    });
    return worktreePath;
  }

  async remove(worktreePath: string): Promise<void> {
    execSync(`git worktree remove ${worktreePath}`, { encoding: 'utf-8' });
  }

  async list(): Promise<string[]> {
    const output = execSync(`git -C ${this.mainRepo} worktree list --porcelain`, {
      encoding: 'utf-8',
    });
    const paths: string[] = [];
    for (const line of output.split('\n')) {
      if (line.startsWith('worktree ')) {
        paths.push(line.slice(9));
      }
    }
    return paths;
  }
}
