// packages/daemon/src/state/manager.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { Mutex } from 'async-mutex';
import {
  WorkflowState,
  WorkflowStateSchema,
  TaskState,
  ClaimResult,
  TaskStatus,
} from '../types/state.js';

export interface StateIssue {
  type: 'orphaned_task' | 'stale_agent' | 'invalid_reference';
  taskId?: string;
  agentId?: string;
  message: string;
}

export interface RecoveryResult {
  state: WorkflowState | null;
  repaired: StateIssue[];
}

export class StateManager {
  private readonly worktreeRoot: string;
  private readonly stateFile: string;
  private readonly mutex: Mutex;
  private cachedState: WorkflowState | null = null;

  constructor(worktreeRoot: string) {
    this.worktreeRoot = worktreeRoot;
    this.stateFile = path.join(worktreeRoot, '.hyh', 'state.json');
    this.mutex = new Mutex();
  }

  async load(): Promise<WorkflowState | null> {
    return this.mutex.runExclusive(async () => {
      try {
        const content = await fs.readFile(this.stateFile, 'utf-8');
        const data = JSON.parse(content);
        this.cachedState = WorkflowStateSchema.parse(data);
        return this.cachedState;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          this.cachedState = null;
          return null;
        }
        throw error;
      }
    });
  }

  async save(state: WorkflowState): Promise<void> {
    return this.mutex.runExclusive(async () => {
      // Validate state
      const validated = WorkflowStateSchema.parse(state);

      // Ensure directory exists
      const dir = path.dirname(this.stateFile);
      await fs.mkdir(dir, { recursive: true });

      // Atomic write: temp file -> fsync -> rename
      const tempFile = `${this.stateFile}.tmp`;
      const content = JSON.stringify(validated, null, 2);

      const handle = await fs.open(tempFile, 'w');
      try {
        await handle.writeFile(content);
        await handle.sync();
      } finally {
        await handle.close();
      }

      await fs.rename(tempFile, this.stateFile);
      this.cachedState = validated;
    });
  }

  async claimTask(workerId: string): Promise<ClaimResult> {
    return this.mutex.runExclusive(async () => {
      if (!workerId || !workerId.trim()) {
        throw new Error('Worker ID cannot be empty');
      }

      const state = await this.loadInternal();
      if (!state) {
        return { task: null, isRetry: false, isReclaim: false };
      }

      // Find task for this worker (existing claim or new claimable)
      const task = this.getTaskForWorker(state, workerId);
      if (!task) {
        return { task: null, isRetry: false, isReclaim: false };
      }

      const wasMine = task.claimedBy === workerId;
      const isRetry = wasMine && task.status === TaskStatus.RUNNING;
      const isReclaim =
        !wasMine && task.status === TaskStatus.RUNNING && this.isTimedOut(task);

      // Update task
      const now = Date.now();
      const updatedTask: TaskState = {
        ...task,
        status: TaskStatus.RUNNING,
        claimedBy: workerId,
        startedAt: now,
        claimedAt: now,
      };

      // Update state
      const newState: WorkflowState = {
        ...state,
        tasks: {
          ...state.tasks,
          [task.id]: updatedTask,
        },
      };

      await this.saveInternal(newState);

      return { task: updatedTask, isRetry, isReclaim };
    });
  }

  async completeTask(taskId: string, workerId: string, force: boolean = false): Promise<void> {
    return this.mutex.runExclusive(async () => {
      const state = await this.loadInternal();
      if (!state) {
        throw new Error('No workflow state');
      }

      const task = state.tasks[taskId];
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      if (!force && task.claimedBy !== workerId) {
        throw new Error(
          `Task ${taskId} not owned by ${workerId} (owned by ${task.claimedBy ?? 'nobody'})`
        );
      }

      const updatedTask: TaskState = {
        ...task,
        status: TaskStatus.COMPLETED,
        completedAt: Date.now(),
      };

      const newState: WorkflowState = {
        ...state,
        tasks: {
          ...state.tasks,
          [taskId]: updatedTask,
        },
      };

      await this.saveInternal(newState);
    });
  }

  async reset(): Promise<void> {
    return this.mutex.runExclusive(async () => {
      try {
        await fs.unlink(this.stateFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }
      this.cachedState = null;
    });
  }

  /**
   * Flush cached state to disk.
   * Note: This is a no-op since all state mutations are immediately persisted
   * via atomic writes. This method exists to satisfy the EventLoop interface
   * and can be used for future optimizations (e.g., batched writes).
   */
  flush(): void {
    // No-op: writes are already immediate and atomic
    // The cachedState is always in sync with disk after save()
  }

  async update(updater: (state: WorkflowState) => void): Promise<void> {
    return this.mutex.runExclusive(async () => {
      let state = await this.loadInternal();
      if (!state) {
        // Create default state if none exists
        state = {
          workflowId: 'default',
          workflowName: 'default',
          startedAt: Date.now(),
          currentPhase: '',
          phaseHistory: [],
          tasks: {},
          agents: {},
          checkpoints: {},
          pendingHumanActions: [],
        };
      }
      updater(state);
      await this.saveInternal(state);
    });
  }

  // Internal methods (must be called within mutex)

  private async loadInternal(): Promise<WorkflowState | null> {
    if (this.cachedState) {
      return this.cachedState;
    }

    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      const data = JSON.parse(content);
      this.cachedState = WorkflowStateSchema.parse(data);
      return this.cachedState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  private async saveInternal(state: WorkflowState): Promise<void> {
    const validated = WorkflowStateSchema.parse(state);

    const dir = path.dirname(this.stateFile);
    await fs.mkdir(dir, { recursive: true });

    const tempFile = `${this.stateFile}.tmp`;
    const content = JSON.stringify(validated, null, 2);

    const handle = await fs.open(tempFile, 'w');
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }

    await fs.rename(tempFile, this.stateFile);
    this.cachedState = validated;
  }

  private getTaskForWorker(state: WorkflowState, workerId: string): TaskState | null {
    // First: check if worker has an existing running task
    for (const task of Object.values(state.tasks)) {
      if (task.status === TaskStatus.RUNNING && task.claimedBy === workerId) {
        return task;
      }
    }

    // Second: find a claimable task
    return this.getClaimableTask(state);
  }

  private getClaimableTask(state: WorkflowState): TaskState | null {
    // Find pending tasks with satisfied dependencies
    for (const task of Object.values(state.tasks)) {
      if (task.status === TaskStatus.PENDING && this.areDependenciesSatisfied(state, task)) {
        return task;
      }
    }

    // Find timed-out running tasks to reclaim
    for (const task of Object.values(state.tasks)) {
      if (
        task.status === TaskStatus.RUNNING &&
        this.isTimedOut(task) &&
        this.areDependenciesSatisfied(state, task)
      ) {
        return task;
      }
    }

    return null;
  }

  private areDependenciesSatisfied(state: WorkflowState, task: TaskState): boolean {
    for (const depId of task.dependencies) {
      const depTask = state.tasks[depId];
      if (!depTask || depTask.status !== TaskStatus.COMPLETED) {
        return false;
      }
    }
    return true;
  }

  private isTimedOut(task: TaskState): boolean {
    if (task.status !== TaskStatus.RUNNING || !task.startedAt) {
      return false;
    }
    const elapsed = Date.now() - task.startedAt;
    return elapsed > task.timeoutSeconds * 1000;
  }

  async recoverFromCrash(): Promise<RecoveryResult> {
    return this.mutex.runExclusive(async () => {
      const state = await this.loadInternal();
      if (!state) {
        return { state: null, repaired: [] };
      }

      const issues = this.validateStateInternal(state);
      if (issues.length === 0) {
        return { state, repaired: [] };
      }

      const repairedState = this.repairStateInternal(state, issues);
      await this.saveInternal(repairedState);

      return { state: repairedState, repaired: issues };
    });
  }

  private validateStateInternal(state: WorkflowState): StateIssue[] {
    const issues: StateIssue[] = [];
    const now = Date.now();

    // Check for orphaned running tasks (stale timestamps)
    for (const [taskId, task] of Object.entries(state.tasks)) {
      if (task.status === TaskStatus.RUNNING && task.startedAt) {
        const elapsed = now - task.startedAt;
        if (elapsed > task.timeoutSeconds * 1000) {
          issues.push({
            type: 'orphaned_task',
            taskId,
            message: `Task ${taskId} timed out (${Math.floor(elapsed / 1000)}s > ${task.timeoutSeconds}s)`,
          });
        }
      }
    }

    return issues;
  }

  private repairStateInternal(state: WorkflowState, issues: StateIssue[]): WorkflowState {
    const newTasks = { ...state.tasks };

    for (const issue of issues) {
      if (issue.type === 'orphaned_task' && issue.taskId) {
        const task = newTasks[issue.taskId];
        if (task) {
          newTasks[issue.taskId] = {
            ...task,
            status: TaskStatus.PENDING,
            claimedBy: null,
            startedAt: null,
            claimedAt: null,
          };
        }
      }
    }

    return { ...state, tasks: newTasks };
  }
}
