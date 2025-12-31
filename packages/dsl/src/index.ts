// @hyh/dsl - TypeScript Workflow DSL
// Fluent API for defining multi-agent workflows

export { workflow } from './builders/workflow.js';
export { agent } from './builders/agent.js';
export { queue } from './builders/queue.js';
export { gate } from './builders/gate.js';
export { task } from './builders/task.js';
export { inv } from './invariants/index.js';
export { correct } from './corrections/index.js';
export { human } from './checkpoints/human.js';
export { compile } from './compiler/index.js';
export type { CompileOptions } from './compiler/index.js';

// Types
export type {
  CompiledWorkflow,
  CompiledAgent,
  CompiledPhase,
  CompiledQueue,
  CompiledGate,
  CompiledInvariant,
  Correction,
  Checkpoint,
} from './types/compiled.js';

export type {
  Duration,
  ToolSpec,
  GlobPattern,
  Model,
  TaskStatus,
} from './types/primitives.js';
