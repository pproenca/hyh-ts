// packages/daemon/src/plan/importer.test.ts
import { describe, it, expect } from 'vitest';
import { PlanImporter } from './importer.js';

describe('PlanImporter', () => {
  it('parses tasks.md format into task states', () => {
    const markdown = `
# Tasks

## Task 1: Setup
- Files: src/setup.ts
- Dependencies: none

## Task 2: Feature
- Files: src/feature.ts
- Dependencies: Task 1
`;

    const importer = new PlanImporter();
    const tasks = importer.parseMarkdown(markdown);

    expect(tasks).toHaveLength(2);
    expect(tasks[0].id).toBe('task-1');
    expect(tasks[1].dependencies).toContain('task-1');
  });

  it('handles tasks with no dependencies', () => {
    const markdown = `
## Task 1: First task
- Files: src/first.ts
- Dependencies: none
`;

    const importer = new PlanImporter();
    const tasks = importer.parseMarkdown(markdown);

    expect(tasks[0].dependencies).toHaveLength(0);
  });

  it('converts parsed tasks to task states', () => {
    const importer = new PlanImporter();
    const parsed = [
      { id: 'task-1', description: 'Setup', files: ['src/setup.ts'], dependencies: [] },
    ];

    const states = importer.toTaskStates(parsed);

    expect(states['task-1']).toBeDefined();
    expect(states['task-1'].status).toBe('pending');
    expect(states['task-1'].description).toBe('Setup');
  });
});
