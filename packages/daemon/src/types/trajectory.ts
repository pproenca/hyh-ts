// packages/daemon/src/types/trajectory.ts
import { z } from 'zod';

// Base event schema
const BaseEventSchema = z.object({
  timestamp: z.number(),
  agentId: z.string(),
});

// Tool use event
export const ToolUseEventSchema = BaseEventSchema.extend({
  type: z.literal('tool_use'),
  tool: z.string(),
  args: z.record(z.string(), z.unknown()).optional(),
  path: z.string().optional(),
});

export type ToolUseEvent = z.infer<typeof ToolUseEventSchema>;

// Tool result event
export const ToolResultEventSchema = BaseEventSchema.extend({
  type: z.literal('tool_result'),
  tool: z.string(),
  result: z.unknown(),
});

// Message event
export const MessageEventSchema = BaseEventSchema.extend({
  type: z.literal('message'),
  content: z.string(),
});

// Heartbeat event
export const HeartbeatEventSchema = BaseEventSchema.extend({
  type: z.literal('heartbeat'),
});

// Correction event
export const CorrectionEventSchema = BaseEventSchema.extend({
  type: z.literal('correction'),
  violation: z.object({
    type: z.string(),
    message: z.string().optional(),
  }),
  correction: z.object({
    type: z.string(),
    message: z.string().optional(),
  }),
});

export type CorrectionEvent = z.infer<typeof CorrectionEventSchema>;

// Spawn event
export const SpawnEventSchema = BaseEventSchema.extend({
  type: z.literal('spawn'),
  agentType: z.string(),
  taskId: z.string().nullable(),
  pid: z.number(),
  sessionId: z.string(),
});

export type SpawnEvent = z.infer<typeof SpawnEventSchema>;

// Phase transition event
export const PhaseTransitionEventSchema = z.object({
  type: z.literal('phase_transition'),
  timestamp: z.number(),
  from: z.string(),
  to: z.string(),
});

// Task claim event
export const TaskClaimEventSchema = BaseEventSchema.extend({
  type: z.literal('task_claim'),
  taskId: z.string(),
});

// Task complete event
export const TaskCompleteEventSchema = BaseEventSchema.extend({
  type: z.literal('task_complete'),
  taskId: z.string(),
});

// Union of all trajectory events
export const TrajectoryEventSchema = z.discriminatedUnion('type', [
  ToolUseEventSchema,
  ToolResultEventSchema,
  MessageEventSchema,
  HeartbeatEventSchema,
  CorrectionEventSchema,
  SpawnEventSchema,
  PhaseTransitionEventSchema,
  TaskClaimEventSchema,
  TaskCompleteEventSchema,
]);

export type TrajectoryEvent = z.infer<typeof TrajectoryEventSchema>;
