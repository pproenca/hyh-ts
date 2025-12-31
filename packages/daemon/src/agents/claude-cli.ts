// packages/daemon/src/agents/claude-cli.ts
import { execSync } from 'node:child_process';

export interface ClaudeCliInfo {
  available: boolean;
  version?: string;
  error?: string;
}

export async function checkClaudeCli(): Promise<ClaudeCliInfo> {
  try {
    const version = execSync('claude --version', {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim();

    const match = version.match(/(\d+\.\d+\.\d+)/);
    const versionStr = match?.[1] ?? 'unknown';

    return {
      available: true,
      version: versionStr,
    } as ClaudeCliInfo;
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
