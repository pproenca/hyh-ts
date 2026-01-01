// packages/daemon/src/types/state.ts
import { z } from 'zod';

// Branded types for type-safe record keys
declare const TaskIdBrand: unique symbol;
declare const AgentIdBrand: unique symbol;
declare const CheckpointIdBrand: unique symbol;
declare const ViolationTypeBrand: unique symbol;

/** Branded type for task identifiers */
export type TaskId = string & { readonly [TaskIdBrand]: typeof TaskIdBrand };

/** Branded type for agent identifiers */
export type AgentId = string & { readonly [AgentIdBrand]: typeof AgentIdBrand };

/** Branded type for checkpoint identifiers */
export type CheckpointId = string & { readonly [CheckpointIdBrand]: typeof CheckpointIdBrand };

/** Branded type for violation type names */
export type ViolationType = string & { readonly [ViolationTypeBrand]: typeof ViolationTypeBrand };

/** Create a TaskId from a string */
export function taskId(id: string): TaskId {
  return id as TaskId;
}

/** Create an AgentId from a string */
export function agentId(id: string): AgentId {
  return id as AgentId;
}

/** Create a CheckpointId from a string */
export function checkpointId(id: string): CheckpointId {
  return id as CheckpointId;
}

/** Create a ViolationType from a string */
export function violationType(type: string): ViolationType {
  return type as ViolationType;
}

// Task status enum
export const TaskStatus = {
  PENDING: 'pending',
  CLAIMED: 'claimed',
  RUNNING: 'running',
  VERIFYING: 'verifying',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type TaskStatusType = (typeof TaskStatus)[keyof typeof TaskStatus];

// Task state schema
export const TaskStateSchema = z.object({
  id: z.string().min(1, 'Task ID cannot be empty'),
  description: z.string(),
  instructions: z.string().optional(),
  success: z.string().optional(),
  status: z.enum(['pending', 'claimed', 'running', 'verifying', 'completed', 'failed']),
  claimedBy: z.string().nullable().default(null),
  claimedAt: z.number().nullable().default(null),
  startedAt: z.number().nullable().default(null),
  completedAt: z.number().nullable().default(null),
  attempts: z.number().default(0),
  lastError: z.string().nullable().default(null),
  dependencies: z.array(z.string()).default([]),
  files: z.array(z.string()).default([]),
  role: z.string().optional(),
  model: z.string().optional(),
  priority: z.number().optional(),
  timeoutSeconds: z.number().default(600),
});

export type TaskState = z.infer<typeof TaskStateSchema>;

// Queue state schema
// Note: z.record uses string keys at runtime; use TaskId branded type in application code
export const QueueStateSchema = z.object({
  tasks: z.record(z.string(), TaskStateSchema),
});

export type QueueState = z.infer<typeof QueueStateSchema>;

// Agent state schema
export const AgentStateSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.enum(['idle', 'active', 'stopped']),
  currentTask: z.string().nullable().default(null),
  pid: z.number().nullable().default(null),
  sessionId: z.string().nullable().default(null),
  lastHeartbeat: z.number().nullable().default(null),
  // Note: Keys are ViolationType branded strings at runtime; Zod validates as string
  violationCounts: z.record(z.string(), z.number()).default({}),
});

export type AgentState = z.infer<typeof AgentStateSchema>;

// Phase transition schema
export const PhaseTransitionSchema = z.object({
  from: z.string(),
  to: z.string(),
  timestamp: z.number(),
});

export type PhaseTransition = z.infer<typeof PhaseTransitionSchema>;

// Checkpoint state schema
export const CheckpointStateSchema = z.object({
  id: z.string(),
  passed: z.boolean(),
  passedAt: z.number().nullable().default(null),
});

export type CheckpointState = z.infer<typeof CheckpointStateSchema>;

// Log entry schema
export const LogEntrySchema = z.object({
  timestamp: z.number(),
  agentId: z.string(),
  message: z.string(),
});

export type LogEntry = z.infer<typeof LogEntrySchema>;

// Todo progress schema
export const TodoProgressSchema = z.object({
  total: z.number(),
  completed: z.number(),
  incomplete: z.array(z.string()),
});

export type TodoProgress = z.infer<typeof TodoProgressSchema>;

// Human action schema for pending human interventions
export const HumanActionSchema = z.object({
  type: z.string(),
  message: z.string(),
  checkpointId: z.string().optional(),
  timestamp: z.number(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type HumanAction = z.infer<typeof HumanActionSchema>;

// Full workflow state schema
// Note: z.record uses string keys at runtime; use branded types (TaskId, AgentId, CheckpointId) in application code
export const WorkflowStateSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  startedAt: z.number(),
  currentPhase: z.string(),
  phaseHistory: z.array(PhaseTransitionSchema).default([]),
  tasks: z.record(z.string(), TaskStateSchema).default({}),
  agents: z.record(z.string(), AgentStateSchema).default({}),
  checkpoints: z.record(z.string(), CheckpointStateSchema).default({}),
  pendingHumanActions: z.array(HumanActionSchema).default([]),
  recentLogs: z.array(LogEntrySchema).optional(),
  todo: TodoProgressSchema.optional(),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// Claim result for task claiming
export const ClaimResultSchema = z.object({
  task: TaskStateSchema.nullable(),
  isRetry: z.boolean().default(false),
  isReclaim: z.boolean().default(false),
});

export type ClaimResult = z.infer<typeof ClaimResultSchema>;
