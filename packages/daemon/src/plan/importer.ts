// packages/daemon/src/plan/importer.ts
import type { TaskState } from '../types/state.js';
import { TaskStatus } from '../types/state.js';

export interface ParsedTask {
  id: string;
  description: string;
  files: string[];
  dependencies: string[];
}

export class PlanImporter {
  parseMarkdown(content: string): ParsedTask[] {
    const tasks: ParsedTask[] = [];
    const sections = content.split(/(?=##\s+Task)/);

    for (const section of sections) {
      const match = section.match(/##\s+Task\s+(\d+):\s+(.+)/);
      if (!match) continue;

      const [, num, description] = match;
      const id = `task-${num}`;

      // Parse files
      const filesMatch = section.match(/Files?:\s*(.+)/i);
      const files = filesMatch
        ? filesMatch[1].split(',').map(f => f.trim())
        : [];

      // Parse dependencies
      const depsMatch = section.match(/Dependencies?:\s*(.+)/i);
      let dependencies: string[] = [];
      if (depsMatch && depsMatch[1].toLowerCase() !== 'none') {
        dependencies = depsMatch[1]
          .split(',')
          .map(d => d.trim().toLowerCase().replace(/task\s+/i, 'task-'));
      }

      tasks.push({ id, description: description.trim(), files, dependencies });
    }

    return tasks;
  }

  toTaskStates(parsed: ParsedTask[]): Record<string, TaskState> {
    const states: Record<string, TaskState> = {};
    for (const task of parsed) {
      states[task.id] = {
        id: task.id,
        description: task.description,
        status: TaskStatus.PENDING,
        claimedBy: null,
        claimedAt: null,
        startedAt: null,
        completedAt: null,
        attempts: 0,
        lastError: null,
        dependencies: task.dependencies,
        files: task.files,
        timeoutSeconds: 600,
      };
    }
    return states;
  }
}
