// packages/daemon/src/types/ipc.ts
import { z } from 'zod';

// Request types (discriminated union)
export const GetStateRequestSchema = z.object({
  command: z.literal('get_state'),
});

export const StatusRequestSchema = z.object({
  command: z.literal('status'),
  eventCount: z.number().optional().default(10),
});

export const PingRequestSchema = z.object({
  command: z.literal('ping'),
});

export const ShutdownRequestSchema = z.object({
  command: z.literal('shutdown'),
});

export const TaskClaimRequestSchema = z.object({
  command: z.literal('task_claim'),
  workerId: z.string().min(1),
});

export const TaskCompleteRequestSchema = z.object({
  command: z.literal('task_complete'),
  taskId: z.string().min(1),
  workerId: z.string().min(1),
  force: z.boolean().optional().default(false),
});

export const ExecRequestSchema = z.object({
  command: z.literal('exec'),
  args: z.array(z.string()).min(1),
  cwd: z.string().optional(),
  env: z.record(z.string(), z.string()).optional(),
  timeout: z.number().positive().optional(),
  exclusive: z.boolean().optional().default(false),
});

export const PlanImportRequestSchema = z.object({
  command: z.literal('plan_import'),
  content: z.string().min(1),
});

export const PlanResetRequestSchema = z.object({
  command: z.literal('plan_reset'),
});

export const HeartbeatRequestSchema = z.object({
  command: z.literal('heartbeat'),
  workerId: z.string().min(1),
});

export const SubscribeRequestSchema = z.object({
  command: z.literal('subscribe'),
  channel: z.string().min(1),
});

// Union of all request types
export const IPCRequestSchema = z.discriminatedUnion('command', [
  GetStateRequestSchema,
  StatusRequestSchema,
  PingRequestSchema,
  ShutdownRequestSchema,
  TaskClaimRequestSchema,
  TaskCompleteRequestSchema,
  ExecRequestSchema,
  PlanImportRequestSchema,
  PlanResetRequestSchema,
  HeartbeatRequestSchema,
  SubscribeRequestSchema,
]);

export type IPCRequest = z.infer<typeof IPCRequestSchema>;

// Response types
export const OkResponseSchema = z.object({
  status: z.literal('ok'),
  data: z.unknown(),
});

export const ErrorResponseSchema = z.object({
  status: z.literal('error'),
  message: z.string(),
});

export const IPCResponseSchema = z.discriminatedUnion('status', [
  OkResponseSchema,
  ErrorResponseSchema,
]);

export type IPCResponse = z.infer<typeof IPCResponseSchema>;

// Push events (daemon -> clients)
export const StateChangedEventSchema = z.object({
  type: z.literal('state_changed'),
  state: z.unknown(),
});

export const TrajectoryEventPushSchema = z.object({
  type: z.literal('trajectory_event'),
  event: z.unknown(),
});

export const AgentOutputEventSchema = z.object({
  type: z.literal('agent_output'),
  agentId: z.string(),
  data: z.string(),
});

export const HumanRequiredEventSchema = z.object({
  type: z.literal('human_required'),
  checkpoint: z.unknown(),
});

export const IPCEventSchema = z.discriminatedUnion('type', [
  StateChangedEventSchema,
  TrajectoryEventPushSchema,
  AgentOutputEventSchema,
  HumanRequiredEventSchema,
]);

export type IPCEvent = z.infer<typeof IPCEventSchema>;
