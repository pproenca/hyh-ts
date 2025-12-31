#!/usr/bin/env node
import { Command } from 'commander';
import { registerCompileCommand } from './commands/compile.js';
import { registerStatusCommand } from './commands/status.js';

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
registerStatusCommand(program);

program.parse();
