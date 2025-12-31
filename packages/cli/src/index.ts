#!/usr/bin/env node
import { Command } from 'commander';
import { registerCompileCommand } from './commands/compile.js';
import { registerInitCommand } from './commands/init.js';
import { registerRunCommand } from './commands/run.js';
import { registerStatusCommand } from './commands/status.js';
import { registerTaskCommand } from './commands/task.js';
import { registerVerifyCompleteCommand } from './commands/verify-complete.js';

const program = new Command();

program
  .name('hyh')
  .description('Hold Your Horses - Workflow Orchestration CLI')
  .version('0.1.0');

program
  .command('version')
  .description('Show version')
  .action(() => {
    console.log('hyh v0.1.0');
  });

// Register commands
registerCompileCommand(program);
registerInitCommand(program);
registerRunCommand(program);
registerStatusCommand(program);
registerTaskCommand(program);
registerVerifyCompleteCommand(program);

program.parse();
