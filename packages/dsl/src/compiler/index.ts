// packages/dsl/src/compiler/index.ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CompiledWorkflow } from '../types/compiled.js';
import { generateAgentPrompt } from './prompt-generator.js';
import { generateHooksJson } from './hooks-generator.js';

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

export async function compileToDir(
  workflow: CompiledWorkflow,
  outputDir: string,
  options: CompileOptions = {}
): Promise<void> {
  const compiled = compile(workflow, options);

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.join(outputDir, 'agents'), { recursive: true });

  // Write workflow.json
  const workflowPath = path.join(outputDir, 'workflow.json');
  await fs.writeFile(workflowPath, JSON.stringify(compiled, null, 2));

  // Write agent prompts
  for (const [name, agentDef] of Object.entries(compiled.agents)) {
    const prompt = generateAgentPrompt(agentDef);
    const promptPath = path.join(outputDir, 'agents', `${name}.md`);
    await fs.writeFile(promptPath, prompt);
  }

  // Write hooks.json
  const hooks = generateHooksJson(compiled);
  const hooksPath = path.join(outputDir, 'hooks.json');
  await fs.writeFile(hooksPath, JSON.stringify(hooks, null, 2));
}
