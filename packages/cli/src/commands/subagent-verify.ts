// packages/cli/src/commands/subagent-verify.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Command } from 'commander';

const execAsync = promisify(exec);

interface SubagentVerifyOptions {
  cwd?: string;
  tests?: boolean;
  typecheck?: boolean;
  lint?: boolean;
}

interface VerifyResult {
  passed: boolean;
  checks: string[];
  errors: string[];
}

export async function subagentVerify(options: SubagentVerifyOptions = {}): Promise<VerifyResult> {
  const cwd = options.cwd ?? process.cwd();
  const errors: string[] = [];
  const checks: string[] = [];

  // Check todo.md
  const todoPath = path.join(cwd, 'todo.md');
  try {
    const content = await fs.readFile(todoPath, 'utf-8');
    const incomplete = (content.match(/- \[ \]/g) || []).length;
    if (incomplete > 0) {
      errors.push(`${incomplete} incomplete todo item(s)`);
    }
    checks.push('todo');
  } catch {
    // No todo.md file is acceptable - subagent may not use todos
  }

  // Run tests if requested
  if (options.tests) {
    try {
      await execAsync('npm test', { cwd });
      checks.push('tests');
    } catch {
      // Test command exited with non-zero status
      errors.push('Tests failed');
    }
  }

  // Run typecheck if requested
  if (options.typecheck) {
    try {
      await execAsync('npm run typecheck', { cwd });
      checks.push('typecheck');
    } catch {
      // Typecheck command exited with non-zero status
      errors.push('Typecheck failed');
    }
  }

  // Run lint if requested
  if (options.lint) {
    try {
      await execAsync('npm run lint', { cwd });
      checks.push('lint');
    } catch {
      // Lint command exited with non-zero status
      errors.push('Lint failed');
    }
  }

  return {
    passed: errors.length === 0,
    checks,
    errors,
  };
}

export function registerSubagentVerifyCommand(program: Command): void {
  program
    .command('subagent-verify')
    .description('Verify subagent completion (used by SubagentStop hook)')
    .option('--tests', 'Run tests')
    .option('--typecheck', 'Run typecheck')
    .option('--lint', 'Run lint')
    .action(async (opts) => {
      const result = await subagentVerify(opts);
      if (!result.passed) {
        console.error('Verification failed:');
        for (const error of result.errors) {
          console.error(`  - ${error}`);
        }
        process.exit(1);
      }
      console.log('Verification passed');
      console.log(`Checks: ${result.checks.join(', ')}`);
    });
}
