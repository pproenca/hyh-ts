// packages/daemon/src/workflow/gate-executor.ts
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface GateCheck {
  type: 'command' | 'verifier';
  command?: string;
  verifier?: string;
}

export interface GateConfig {
  name: string;
  checks: GateCheck[];
}

export interface GateResult {
  passed: boolean;
  failedCheck?: GateCheck;
  error?: string;
}

export class GateExecutor {
  async execute(gate: GateConfig, cwd?: string): Promise<GateResult> {
    for (const check of gate.checks) {
      if (check.type === 'command' && check.command) {
        try {
          await execAsync(check.command, { cwd });
        } catch (error) {
          return {
            passed: false,
            failedCheck: check,
            error: (error as Error).message,
          };
        }
      }
      // Verifier type would spawn a verifier agent - not implemented yet
    }
    return { passed: true };
  }
}
