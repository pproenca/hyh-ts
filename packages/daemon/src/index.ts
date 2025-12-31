// @hyh/daemon - Workflow Runtime Engine
// Manages agent processes, enforces invariants, persists state

export { Daemon } from './core/daemon.js';
export { StateManager } from './state/manager.js';
export { TrajectoryLogger } from './trajectory/logger.js';
export { IPCServer } from './ipc/server.js';

// Agent Management
export { AgentManager } from './agents/manager.js';
export { AgentProcess } from './agents/process.js';
export { HeartbeatMonitor } from './agents/heartbeat.js';
export type { AgentProcessConfig, AgentEvent } from './agents/process.js';
export type { SpawnSpec } from './agents/manager.js';
export type { HeartbeatStatus } from './agents/heartbeat.js';

// Checkers
export { CheckerChain } from './checkers/chain.js';
export { TddChecker } from './checkers/tdd.js';
export { FileScopeChecker } from './checkers/file-scope.js';
export type { Checker, Violation, CheckContext } from './checkers/types.js';
export type { TddCheckerOptions } from './checkers/tdd.js';
export type { FileScopeCheckerOptions } from './checkers/file-scope.js';

// Workflow
export { PhaseManager } from './workflow/phase-manager.js';

// Types - State
export type {
  WorkflowState,
  TaskState,
  AgentState,
  CheckpointState,
  ClaimResult,
} from './types/state.js';

export { TaskStatus } from './types/state.js';

// Types - Trajectory
export type {
  TrajectoryEvent,
  ToolUseEvent,
  CorrectionEvent,
  SpawnEvent,
} from './types/trajectory.js';

// Types - IPC
export type {
  IPCRequest,
  IPCResponse,
} from './types/ipc.js';
