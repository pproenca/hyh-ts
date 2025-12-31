// packages/dsl/src/compiler/index.ts
import { CompiledWorkflow } from '../types/compiled.js';

export interface CompileOptions {
  outputDir?: string;
  validate?: boolean;
}

export function compile(
  workflow: CompiledWorkflow,
  options: CompileOptions = {}
): CompiledWorkflow {
  if (options.validate !== false) {
    validateWorkflow(workflow);
  }
  return workflow;
}

function validateWorkflow(workflow: CompiledWorkflow): void {
  if (!workflow.name) {
    throw new Error('Workflow must have a name');
  }
  if (!workflow.orchestrator) {
    throw new Error('Workflow must have an orchestrator');
  }
  if (workflow.phases.length === 0) {
    throw new Error('Workflow must have at least one phase');
  }

  // Validate phase references
  for (const phase of workflow.phases) {
    if (!workflow.agents[phase.agent]) {
      throw new Error(`Phase '${phase.name}' references unknown agent '${phase.agent}'`);
    }
    if (phase.queue && !workflow.queues[phase.queue]) {
      throw new Error(`Phase '${phase.name}' references unknown queue '${phase.queue}'`);
    }
    if (phase.gate && !workflow.gates[phase.gate]) {
      throw new Error(`Phase '${phase.name}' references unknown gate '${phase.gate}'`);
    }
  }
}
