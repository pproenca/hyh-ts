// packages/cli/src/commands/metrics.ts
import { Command } from 'commander';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { WorkflowMetrics } from '@hyh/daemon';

interface MetricsOptions {
  format: 'json' | 'table' | 'prometheus';
  output?: string;
}

function formatAsTable(metrics: WorkflowMetrics): string {
  const lines: string[] = [];
  lines.push('Workflow Metrics');
  lines.push('================');
  lines.push(`Total Duration: ${(metrics.totalDuration / 1000).toFixed(1)}s`);
  lines.push(`Tasks Completed: ${metrics.tasksCompleted}`);
  lines.push(`Tasks Failed: ${metrics.tasksFailed}`);
  lines.push(`Tasks Retried: ${metrics.tasksRetried}`);
  lines.push(`Human Interventions: ${metrics.humanInterventions}`);
  lines.push(`Agent Spawns: ${metrics.agentSpawns}`);
  lines.push(`Estimated Tokens: ${metrics.estimatedTokensUsed.toLocaleString()}`);

  if (Object.keys(metrics.violationCount).length > 0) {
    lines.push('');
    lines.push('Violations:');
    for (const [type, count] of Object.entries(metrics.violationCount)) {
      lines.push(`  ${type}: ${count}`);
    }
  }

  if (Object.keys(metrics.correctionCount).length > 0) {
    lines.push('');
    lines.push('Corrections:');
    for (const [type, count] of Object.entries(metrics.correctionCount)) {
      lines.push(`  ${type}: ${count}`);
    }
  }

  return lines.join('\n');
}

function formatAsPrometheus(metrics: WorkflowMetrics): string {
  const lines: string[] = [];
  lines.push('# HELP hyh_workflow_duration_seconds Total workflow duration');
  lines.push('# TYPE hyh_workflow_duration_seconds gauge');
  lines.push(`hyh_workflow_duration_seconds ${metrics.totalDuration / 1000}`);

  lines.push('# HELP hyh_tasks_completed_total Total tasks completed');
  lines.push('# TYPE hyh_tasks_completed_total counter');
  lines.push(`hyh_tasks_completed_total ${metrics.tasksCompleted}`);

  lines.push('# HELP hyh_tasks_failed_total Total tasks failed');
  lines.push('# TYPE hyh_tasks_failed_total counter');
  lines.push(`hyh_tasks_failed_total ${metrics.tasksFailed}`);

  lines.push('# HELP hyh_tokens_used_total Estimated tokens used');
  lines.push('# TYPE hyh_tokens_used_total counter');
  lines.push(`hyh_tokens_used_total ${metrics.estimatedTokensUsed}`);

  for (const [type, count] of Object.entries(metrics.violationCount)) {
    lines.push(`hyh_violations_total{type="${type}"} ${count}`);
  }

  return lines.join('\n');
}

export function registerMetricsCommand(program: Command): void {
  program
    .command('metrics')
    .description('Display workflow metrics')
    .option('-f, --format <format>', 'Output format: json, table, prometheus', 'table')
    .option('-o, --output <file>', 'Write output to file')
    .action(async (options: MetricsOptions) => {
      try {
        const stateDir = path.join(process.cwd(), '.hyh');
        const metricsFile = path.join(stateDir, 'metrics.json');

        let metrics: WorkflowMetrics;
        try {
          const content = await fs.readFile(metricsFile, 'utf-8');
          metrics = JSON.parse(content) as WorkflowMetrics;
        } catch {
          // Default empty metrics if file doesn't exist
          metrics = {
            totalDuration: 0,
            phaseDurations: {},
            taskDurations: {},
            tasksCompleted: 0,
            tasksFailed: 0,
            tasksRetried: 0,
            violationCount: {},
            correctionCount: {},
            humanInterventions: 0,
            agentSpawns: 0,
            estimatedTokensUsed: 0,
          };
        }

        let output: string;
        switch (options.format) {
          case 'json':
            output = JSON.stringify(metrics, null, 2);
            break;
          case 'prometheus':
            output = formatAsPrometheus(metrics);
            break;
          case 'table':
          default:
            output = formatAsTable(metrics);
            break;
        }

        if (options.output) {
          await fs.writeFile(options.output, output);
          console.log(`Metrics written to ${options.output}`);
        } else {
          console.log(output);
        }
      } catch (error) {
        console.error('Failed to display metrics:', error);
        process.exit(1);
      }
    });
}
