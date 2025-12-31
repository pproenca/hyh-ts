// packages/cli/src/commands/init.test.ts
import { describe, it, expect } from 'vitest';

describe('init command', () => {
  it('exports createWorkflowTemplate', async () => {
    const { createWorkflowTemplate } = await import('./init.js');
    const template = createWorkflowTemplate();

    expect(template).toContain("import { workflow");
    expect(template).toContain("export default workflow");
  });

  it('exports registerInitCommand', async () => {
    const { registerInitCommand } = await import('./init.js');
    expect(registerInitCommand).toBeDefined();
  });
});
