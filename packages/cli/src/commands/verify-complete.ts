// packages/cli/src/commands/verify-complete.ts
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface VerifyOptions {
  todoFile?: string;
  runTests?: boolean;
  runTypecheck?: boolean;
}

export interface VerifyResult {
  passed: boolean;
  errors: string[];
}

export async function verifyComplete(options: VerifyOptions = {}): Promise<VerifyResult> {
  const errors: string[] = [];

  // Check todo file if specified
  const todoPath = options.todoFile || 'todo.md';
  try {
    const content = await fs.readFile(path.resolve(todoPath), 'utf-8');
    const incomplete = (content.match(/- \[ \]/g) || []).length;
    if (incomplete > 0) {
      errors.push(`${incomplete} incomplete todo items`);
    }
  } catch (error) {
    // Only ignore ENOENT (file not found) - re-throw other errors
    const isNodeError = error instanceof Error && 'code' in error;
    if (!isNodeError || (error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    // Todo file doesn't exist - acceptable, verification passes
  }

  return {
    passed: errors.length === 0,
    errors,
  };
}

export function registerVerifyCompleteCommand(program: Command): void {
  program
    .command('verify-complete')
    .description('Verify task completion before stopping')
    .option('--todo-file <file>', 'Path to todo file', 'todo.md')
    .option('--no-tests', 'Skip test verification')
    .option('--no-typecheck', 'Skip typecheck verification')
    .action(async (options) => {
      const result = await verifyComplete({
        todoFile: options.todoFile,
        runTests: options.tests !== false,
        runTypecheck: options.typecheck !== false,
      });

      if (result.passed) {
        console.log('All verification checks passed');
        process.exit(0);
      } else {
        console.log('Verification failed:');
        for (const error of result.errors) {
          console.log(`  - ${error}`);
        }
        console.log('\nContinue working to complete all items.');
        process.exit(1);
      }
    });
}
