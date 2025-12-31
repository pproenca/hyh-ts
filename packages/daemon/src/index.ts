// @hyh/daemon - Workflow Runtime Engine
// Manages agent processes, enforces invariants, persists state

export { Daemon } from './core/daemon.js';
export { StateManager } from './state/manager.js';
export { TrajectoryLogger } from './trajectory/logger.js';
export { AgentManager } from './agents/manager.js';
export { IPCServer } from './ipc/server.js';
export { CheckerChain } from './checkers/chain.js';

// Types
export type {
  WorkflowState,
  TaskState,
  AgentState,
  QueueState,
} from './types/state.js';

export type {
  TrajectoryEvent,
  ToolUseEvent,
  CorrectionEvent,
  SpawnEvent,
} from './types/trajectory.js';

export type {
  IPCRequest,
  IPCResponse,
  IPCEvent,
} from './types/ipc.js';
