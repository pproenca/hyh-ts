// packages/cli/src/commands/validate.ts
import { Command } from 'commander';
import * as path from 'node:path';
import { compile } from '@hyh/dsl';

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate a workflow file')
    .argument('<workflow>', 'Path to workflow.ts file')
    .action(async (workflowPath: string) => {
      const absolutePath = path.resolve(workflowPath);

      try {
        console.log(`Validating ${workflowPath}...`);

        // Dynamic import
        const module = await import(absolutePath);
        const workflow = module.default;

        if (!workflow || typeof workflow !== 'object') {
          console.error('Error: Workflow file must export default workflow');
          process.exit(1);
        }

        // Validate using compile
        compile(workflow, { validate: true });

        console.log('✓ Workflow is valid');
        console.log(`  Name: ${workflow.name}`);
        console.log(`  Phases: ${workflow.phases?.length || 0}`);
        console.log(`  Agents: ${Object.keys(workflow.agents || {}).length}`);
      } catch (error) {
        console.error('✗ Validation failed:');
        console.error(`  ${(error as Error).message}`);
        process.exit(1);
      }
    });
}
