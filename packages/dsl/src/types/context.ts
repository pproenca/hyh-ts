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

// Forward declaration for CorrectableRule (actual import would cause circular dependency)
// The actual type is in invariants/correctable.ts
import type { CorrectableRule } from '../invariants/correctable.js';

// RuleBuilder context for agent.rules() callback
// Each rule method returns a CorrectableRule that can chain correction verbs
export interface RuleBuilder {
  tdd(options: TddOptions): CorrectableRule;
  fileScope(getter: (ctx: Context) => string[]): CorrectableRule;
  noCode(): CorrectableRule;
  readOnly(): CorrectableRule;
  mustReport(format: string): CorrectableRule;
  mustProgress(timeout: Duration): CorrectableRule;
  externalTodo(options: { file: string; checkBeforeStop: boolean }): CorrectableRule;
  contextLimit(options: { max: number; warn?: number }): CorrectableRule;
}
