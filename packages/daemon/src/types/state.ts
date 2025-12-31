// packages/daemon/src/types/state.ts
import { z } from 'zod';

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

// Full workflow state schema
export const WorkflowStateSchema = z.object({
  workflowId: z.string(),
  workflowName: z.string(),
  startedAt: z.number(),
  currentPhase: z.string(),
  phaseHistory: z.array(PhaseTransitionSchema).default([]),
  tasks: z.record(z.string(), TaskStateSchema).default({}),
  agents: z.record(z.string(), AgentStateSchema).default({}),
  checkpoints: z.record(z.string(), CheckpointStateSchema).default({}),
  pendingHumanActions: z.array(z.unknown()).default([]),
});

export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// Claim result for task claiming
export const ClaimResultSchema = z.object({
  task: TaskStateSchema.nullable(),
  isRetry: z.boolean().default(false),
  isReclaim: z.boolean().default(false),
});

export type ClaimResult = z.infer<typeof ClaimResultSchema>;
