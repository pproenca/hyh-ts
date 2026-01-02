// packages/dsl/src/types/context.ts
import { TaskStatus, Duration, GlobPattern } from './primitives.js';
import { Checkpoint, CompiledRule } from './compiled.js';
import { human } from '../checkpoints/human.js';

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

// Actor context for checkpoint callbacks (evaluated at compile time)
export interface Actor {
  human: typeof human;
}

// TDD options for rule.tdd()
export interface TddOptions {
  test: GlobPattern;
  impl: GlobPattern;
  order?: ('test' | 'impl')[];
  commit?: ('test' | 'impl')[];
}

// RuleBuilder context for agent.rules() callback
export interface RuleBuilder {
  tdd(options: TddOptions): CompiledRule;
  fileScope(getter: (ctx: Context) => string[]): CompiledRule;
  noCode(): CompiledRule;
  readOnly(): CompiledRule;
  mustReport(format: string): CompiledRule;
  mustProgress(timeout: Duration): CompiledRule;
  externalTodo(options: { file: string; checkBeforeStop: boolean }): CompiledRule;
  contextLimit(options: { max: number; warn?: number }): CompiledRule;
}
