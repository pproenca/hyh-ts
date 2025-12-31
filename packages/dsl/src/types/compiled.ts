// packages/dsl/src/types/compiled.ts
import { z } from 'zod';
import type { Model, ToolSpec } from './primitives.js';

// Correction types
export const CorrectionTypeSchema = z.enum([
  'prompt',
  'warn',
  'block',
  'restart',
  'reassign',
  'retry',
  'escalate',
  'compact',
]);
export type CorrectionType = z.infer<typeof CorrectionTypeSchema>;

export interface Correction {
  type: CorrectionType;
  message?: string;
  to?: 'orchestrator' | 'human';
  max?: number;
  backoff?: number;
  preserveTypes?: string[];
  then?: Correction;
}

// Checkpoint types
export interface Checkpoint {
  id: string;
  type: 'approval';
  question?: string;
  timeout?: number;
  onTimeout?: 'abort' | 'continue' | 'escalate';
}

// Compiled invariant
export interface CompiledInvariant {
  type: string;
  agentName?: string;
  options?: Record<string, unknown>;
}

// Compiled agent
export interface CompiledAgent {
  name: string;
  model: Model;
  role: string;
  tools: ToolSpec[];
  spawns: string[];
  invariants: CompiledInvariant[];
  violations: Record<string, Correction[]>;
  heartbeat?: {
    interval: number;
    corrections: Array<{ count: number; correction: Correction }>;
  };
  systemPrompt?: string;
  postToolUse?: {
    matcher: string;
    commands: string[];
  };
  subagentStop?: {
    verify: string[];
  };
  reinject?: {
    every: number;
    content: string;
  };
}

// Compiled phase
export interface CompiledPhase {
  name: string;
  agent: string;
  queue?: string;
  expects: string[];
  forbids: string[];
  requires: string[];
  outputs: string[];
  populates?: string;
  parallel: boolean | number;
  gate?: string;
  then?: string;
  checkpoint?: Checkpoint;
  contextBudget?: number;
}

// Example task for simulation mode
export interface ExampleTask {
  title: string;
  description: string;
}

// Compiled queue
export interface CompiledQueue {
  name: string;
  readyPredicate: string;
  donePredicate?: string;
  timeout: number;
  examples?: ExampleTask[];
}

// Compiled gate
export interface CompiledGate {
  name: string;
  requires: string[];
  onFail?: Correction;
  onFailFinal?: Correction;
}

// Scaling configuration for workflow complexity
export interface ScalingTier {
  maxHours?: number;
  maxDays?: number;
  agents: number;
}

export interface ScalingConfig {
  trivial?: ScalingTier;
  small?: ScalingTier;
  medium?: ScalingTier;
  large?: ScalingTier;
  huge?: ScalingTier;
}

// Pre-compact configuration for context management
export interface PreCompactConfig {
  preserve?: string[];
  summarize?: string[];
  discard?: string[];
}

// Compiled workflow (full structure)
export interface CompiledWorkflow {
  name: string;
  resumable: boolean;
  orchestrator: string;
  agents: Record<string, CompiledAgent>;
  phases: CompiledPhase[];
  queues: Record<string, CompiledQueue>;
  gates: Record<string, CompiledGate>;
  scaling?: ScalingConfig;
  preCompact?: PreCompactConfig;
}
