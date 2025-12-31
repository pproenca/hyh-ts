// packages/dsl/src/types/primitives.ts
// Primitive types used across the DSL

import { z } from 'zod';

// Duration type for time intervals (e.g., "30s", "5m", "1h")
export const DurationSchema = z.string().regex(/^\d+[smhd]$/, {
  message: 'Duration must be a number followed by s, m, h, or d (e.g., "30s", "5m")',
});
export type Duration = z.infer<typeof DurationSchema>;

// Model type for LLM model identifiers
export const ModelSchema = z.enum([
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
  'o3',
  'gpt-4.1',
]);
export type Model = z.infer<typeof ModelSchema>;

// Task status type
export const TaskStatusSchema = z.enum([
  'pending',
  'claimed',
  'in_progress',
  'blocked',
  'completed',
  'failed',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// Glob pattern for file matching
export const GlobPatternSchema = z.string();
export type GlobPattern = z.infer<typeof GlobPatternSchema>;

// Tool specification
export const ToolSpecSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    allow: z.array(GlobPatternSchema).optional(),
    deny: z.array(GlobPatternSchema).optional(),
  }),
]);
export type ToolSpec = z.infer<typeof ToolSpecSchema>;
