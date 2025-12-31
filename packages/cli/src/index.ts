#!/usr/bin/env node
import { Command } from 'commander';

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

program.parse();
