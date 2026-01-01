// packages/dsl/src/types/context.ts
import { TaskStatus } from './primitives.js';
import { Checkpoint } from './compiled.js';

// Task type for runtime context
export interface Task {
  id: string;
  description: string;
  instructions: string;
  success: string;
  status: TaskStatus;
  claimedBy: string | null;
  startedAt: number | null;
  completedAt: number | null;
  deps: {
    ids: string[];
    allComplete: boolean;
  };
  files: string[];
  role?: string;
  model?: string;
  priority?: number;
}

// Execution result from running commands
export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  passed: boolean;
}

// Git operations interface
export interface GitOps {
  merge(): Promise<void>;
  commit(message: string): Promise<void>;
  push(): Promise<void>;
}

// Context object available in predicates and callbacks
export interface Context {
  task: Task | null;
  agent: { name: string; type: string };
  phase: string;
  workflow: { name: string };
  trajectory: unknown[];
  exec(cmd: string): Promise<ExecResult>;
  verifiedBy(agentName: string): Promise<boolean>;
  git: GitOps;
  uniqueId(): string;
  lastCheckpoint: Checkpoint | null;
}
