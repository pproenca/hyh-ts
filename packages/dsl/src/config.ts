/**
 * Daemon configuration options
 */
export interface DaemonConfig {
  /** Custom socket path (default: ~/.hyh/daemon.sock) */
  socketPath?: string;
  /** State directory (default: .hyh in project root) */
  stateDir?: string;
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Claude model configuration
 */
export interface ClaudeConfig {
  /** Default model for agents */
  defaultModel?: 'sonnet' | 'opus' | 'haiku';
  /** Maximum tokens per request */
  maxTokens?: number;
  /** Request timeout (e.g., '5m', '30s') */
  timeout?: string;
}

/**
 * Git integration configuration
 */
export interface GitConfig {
  /** Main branch name (default: 'main') */
  mainBranch?: string;
  /** Directory for worktrees */
  worktreeDir?: string;
  /** Auto-commit on task completion */
  autoCommit?: boolean;
}

/**
 * Complete hyh configuration
 */
export interface HyhConfig {
  daemon?: DaemonConfig;
  claude?: ClaudeConfig;
  git?: GitConfig;
}

/**
 * Type-safe config definition helper.
 * Use in hyh.config.ts:
 *
 * @example
 * export default defineConfig({
 *   claude: { defaultModel: 'sonnet' }
 * });
 */
export function defineConfig(config: HyhConfig): HyhConfig {
  return config;
}
