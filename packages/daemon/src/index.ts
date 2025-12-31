// @hyh/daemon - Workflow Runtime Engine
// Manages agent processes, enforces invariants, persists state

// Core
export { Daemon } from './core/daemon.js';
export { EventLoop } from './core/event-loop.js';
export type { EventLoopOptions } from './core/event-loop.js';

// State
export { StateManager } from './state/manager.js';

// Trajectory
export { TrajectoryLogger } from './trajectory/logger.js';
export { MetricsCollector, type WorkflowMetrics } from './trajectory/metrics.js';

// IPC
export { IPCServer } from './ipc/server.js';
export { IPCClient } from './ipc/client.js';
export type { IPCClientOptions } from './ipc/client.js';

// Agent Management
export { AgentManager } from './agents/manager.js';
export { AgentProcess } from './agents/process.js';
export { HeartbeatMonitor } from './agents/heartbeat.js';
export { ClaudeOutputParser } from './agents/output-parser.js';
export { checkClaudeCli, type ClaudeCliInfo } from './agents/claude-cli.js';
export type { AgentProcessConfig, AgentEvent } from './agents/process.js';
export type { SpawnSpec } from './agents/manager.js';
export type { HeartbeatStatus } from './agents/heartbeat.js';
export type { ClaudeEvent } from './agents/output-parser.js';

// Checkers
export { CheckerChain } from './checkers/chain.js';
export { TddChecker } from './checkers/tdd.js';
export { FileScopeChecker } from './checkers/file-scope.js';
export { NoCodeChecker } from './checkers/no-code.js';
export { MustProgressChecker } from './checkers/must-progress.js';
export { PhaseToolChecker } from './checkers/phase-tool.js';
export { TodoChecker } from './checkers/todo.js';
export { ContextBudgetChecker, estimateTokens } from './checkers/context-budget.js';
export type { Checker, Violation, CheckContext } from './checkers/types.js';
export type { TddCheckerOptions } from './checkers/tdd.js';
export type { FileScopeCheckerOptions } from './checkers/file-scope.js';
export type { TodoCheckerOptions } from './checkers/todo.js';
export type { ContextBudgetOptions } from './checkers/context-budget.js';

// Corrections
export { CorrectionApplicator } from './corrections/applicator.js';
export type { Correction } from './corrections/applicator.js';
export { CompactHandler } from './corrections/compact-handler.js';

// Workflow
export { WorkflowLoader } from './workflow/loader.js';
export { PhaseManager } from './workflow/phase-manager.js';
export { SpawnTriggerManager } from './workflow/spawn-trigger.js';
export type { SpawnSpec as WorkflowSpawnSpec } from './workflow/spawn-trigger.js';
export { GateExecutor } from './workflow/gate-executor.js';

// Plan
export { PlanImporter } from './plan/importer.js';
export type { ParsedTask } from './plan/importer.js';

// Git
export { WorktreeManager } from './git/worktree.js';

// Managers
export { ArtifactManager } from './managers/artifact.js';
export type { Artifact } from './managers/artifact.js';
export { ReinjectionManager } from './managers/reinjection.js';
export type { ReinjectionOptions, ReinjectionContext } from './managers/reinjection.js';

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
  StopEvent,
} from './types/trajectory.js';

// Types - IPC
export type {
  IPCRequest,
  IPCResponse,
} from './types/ipc.js';
