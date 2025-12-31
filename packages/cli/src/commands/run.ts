// packages/cli/src/commands/run.ts
import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import type { HyhConfig } from '@hyh/dsl';

interface RunOptions {
  tui: boolean;
  config?: string;
}

/**
 * Load hyh configuration from hyh.config.ts or specified path.
 * Returns empty config if no file found.
 */
async function loadConfig(projectDir: string, configPath?: string): Promise<HyhConfig> {
  const configFile = configPath
    ? path.resolve(projectDir, configPath)
    : path.join(projectDir, 'hyh.config.ts');

  try {
    const { default: config } = await import(pathToFileURL(configFile).href);
    return config as HyhConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      return {}; // No config file, use defaults
    }
    throw error;
  }
}

export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('Run a workflow')
    .argument('<workflow>', 'Path to workflow.ts file')
    .option('--no-tui', 'Run without TUI (headless mode)')
    .option('-c, --config <path>', 'Path to config file')
    .action(async (workflowPath: string, options: RunOptions) => {
      const absolutePath = path.resolve(workflowPath);
      const projectDir = path.dirname(absolutePath);
      const outputDir = path.join(projectDir, '.hyh');

      // Check file exists
      try {
        await fs.access(absolutePath);
      } catch {
        console.error(`File not found: ${absolutePath}`);
        process.exit(1);
      }

      console.log(`Compiling ${workflowPath}...`);

      try {
        // Dynamic import of the workflow file
        const workflowUrl = pathToFileURL(absolutePath).href;
        const module = await import(workflowUrl);
        const workflow = module.default;

        if (!workflow || typeof workflow !== 'object') {
          console.error('Workflow file must export default workflow');
          process.exit(1);
        }

        // Import and run compileToDir
        const { compileToDir } = await import('@hyh/dsl');
        await compileToDir(workflow, outputDir);
        console.log(`Compiled to ${outputDir}`);

        // Load config
        const config = await loadConfig(projectDir, options.config);
        if (config.daemon?.logLevel) {
          console.log(`Log level: ${config.daemon.logLevel}`);
        }

        // Check for Claude CLI
        const { checkClaudeCli } = await import('@hyh/daemon');
        const claudeInfo = await checkClaudeCli();

        if (!claudeInfo.available) {
          console.warn(`Warning: Claude CLI not found: ${claudeInfo.error}`);
          console.warn(
            '   Agents will not be able to spawn. Install claude CLI to enable full functionality.'
          );
        }

        // Import and start daemon
        const { Daemon } = await import('@hyh/daemon');
        const daemon = new Daemon({ worktreeRoot: projectDir });
        await daemon.start();
        console.log(`Daemon started on ${daemon.getSocketPath()}`);

        // Keep running until interrupted
        process.on('SIGINT', async () => {
          console.log('\nShutting down...');
          await daemon.stop();
          process.exit(0);
        });

        // Check for plan.md and import tasks
        const planPath = path.join(projectDir, 'plan.md');
        try {
          await fs.access(planPath);
          console.log('Found plan.md, importing tasks...');

          const { PlanImporter } = await import('@hyh/daemon');
          const importer = new PlanImporter();
          const planContent = await fs.readFile(planPath, 'utf-8');
          const parsed = importer.parseMarkdown(planContent);
          const taskStates = importer.toTaskStates(parsed);

          // Add tasks to state
          await daemon.stateManager.update(s => {
            for (const [taskId, taskState] of Object.entries(taskStates)) {
              s.tasks[taskId] = taskState;
            }
          });

          console.log(`Imported ${parsed.length} tasks from plan.md`);
        } catch {
          // No plan.md, continue without importing
        }

        if (!options.tui) {
          console.log('Running in headless mode. Press Ctrl+C to stop.');
        } else {
          // Load workflow into daemon
          await daemon.loadWorkflow(path.join(outputDir, 'workflow.json'));

          // Start TUI
          const { startTUI } = await import('@hyh/tui');
          startTUI(daemon.getSocketPath());
        }
      } catch (error) {
        console.error('Failed to run workflow:', error);
        process.exit(1);
      }
    });
}
