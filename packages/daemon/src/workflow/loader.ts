// packages/daemon/src/workflow/loader.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CompiledWorkflow } from '@hyh/dsl';

export class WorkflowLoader {
  private readonly workflowPath: string;

  constructor(worktreeRoot: string) {
    this.workflowPath = path.join(worktreeRoot, '.hyh', 'workflow.json');
  }

  async load(): Promise<CompiledWorkflow> {
    const content = await fs.readFile(this.workflowPath, 'utf-8');
    return JSON.parse(content) as CompiledWorkflow;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.workflowPath);
      return true;
    } catch {
      return false;
    }
  }
}
