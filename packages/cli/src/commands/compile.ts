// packages/cli/src/commands/compile.ts
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function registerCompileCommand(program: Command): void {
  program
    .command('compile')
    .description('Compile workflow.ts to .hyh/ artifacts')
    .argument('<workflow>', 'Path to workflow.ts file')
    .option('-o, --output <dir>', 'Output directory', '.hyh')
    .action(async (workflowPath: string, options: { output: string }) => {
      const absolutePath = path.resolve(workflowPath);

      // Check file exists
      try {
        await fs.access(absolutePath);
      } catch {
        // Workflow file not found or not accessible
        console.error(`File not found: ${absolutePath}`);
        process.exit(1);
      }

      console.log(`Compiling ${workflowPath}...`);

      try {
        // Dynamic import the workflow file (must be built .js or use tsx)
        const workflowUrl = pathToFileURL(absolutePath).href;
        const module = await import(workflowUrl);
        const workflow = module.default;

        if (!workflow || !workflow.name) {
          console.error('Workflow file must export default a compiled workflow');
          process.exit(1);
        }

        // Import compileToDir
        const { compileToDir } = await import('@hyh/dsl');

        const outputDir = path.resolve(options.output);
        await compileToDir(workflow, outputDir);

        console.log(`Compiled to ${outputDir}/`);
        console.log('  - workflow.json');
        console.log('  - hooks.json');
        console.log(`  - agents/ (${Object.keys(workflow.agents).length} prompts)`);
      } catch (error) {
        console.error('Compilation failed:', error);
        process.exit(1);
      }
    });
}
