// packages/dsl/src/types/primitives.ts
import { z } from 'zod';

// Duration: string like '10m', '30s', '2h' or milliseconds as number
type DurationUnit = 's' | 'm' | 'h' | 'd';
export type Duration = `${number}${DurationUnit}` | number;

const UNIT_MS: Record<DurationUnit, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDuration(duration: Duration): number {
  if (typeof duration === 'number') {
    return duration;
  }

  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  const [, value, unit] = match;
  return parseInt(value!, 10) * UNIT_MS[unit as DurationUnit];
}

// Glob pattern for file matching
export type GlobPattern = string;

// Claude model types
export const ModelSchema = z.enum(['haiku', 'sonnet', 'opus']);
export type Model = z.infer<typeof ModelSchema>;

// Task status
export const TaskStatusSchema = z.enum([
  'pending',
  'claimed',
  'running',
  'verifying',
  'complete',
  'failed',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Tool specification with optional constraints
export type ToolSpec = string | { tool: string; pattern?: string };

export interface ParsedToolSpec {
  tool: string;
  pattern?: string;
}

export function parseToolSpec(spec: ToolSpec): ParsedToolSpec {
  if (typeof spec === 'string') {
    const match = spec.match(/^(\w+)(?:\(([^)]+)\))?$/);
    if (!match) {
      throw new Error(`Invalid tool spec: ${spec}`);
    }
    const [, tool, pattern] = match;
    const result: ParsedToolSpec = { tool: tool! };
    if (pattern) {
      result.pattern = pattern;
    }
    return result;
  }
  return spec;
}

// Duration schema for Zod validation
export const DurationSchema = z.union([
  z.number().positive(),
  z.string().regex(/^\d+(s|m|h|d)$/),
]);
