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

function isDurationUnit(u: string): u is DurationUnit {
  return u === 's' || u === 'm' || u === 'h' || u === 'd';
}

export function parseDuration(duration: Duration): number {
  if (typeof duration === 'number') {
    return duration;
  }

  const match = duration.match(/^(\d+)(s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid duration: ${duration}`);
  }

  const [, value, unit] = match;
  // Safe: regex capture groups guarantee value and unit exist when match succeeds
  if (!value || !unit || !isDurationUnit(unit)) {
    throw new Error(`Invalid duration: ${duration}`);
  }
  return parseInt(value, 10) * UNIT_MS[unit];
}

// Glob pattern for file matching
export type GlobPattern = string;

// Claude model types
export const ModelSchema = z.enum(['haiku', 'sonnet', 'opus']);
export type Model = z.infer<typeof ModelSchema>;

// Task status - matches daemon TaskStatus values
export const TaskStatusSchema = z.enum([
  'pending',
  'claimed',
  'running',
  'verifying',
  'completed',
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
    // Safe: regex requires at least one \w+ char, so tool is guaranteed
    if (!tool) {
      throw new Error(`Invalid tool spec: ${spec}`);
    }
    const result: ParsedToolSpec = { tool };
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
