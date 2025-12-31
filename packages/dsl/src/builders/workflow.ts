// packages/dsl/src/builders/workflow.ts
import { CompiledWorkflow, CompiledAgent, CompiledQueue, CompiledGate, ScalingConfig, PreCompactConfig } from '../types/compiled.js';
import { AgentBuilder } from './agent.js';
import { QueueBuilder } from './queue.js';
import { GateBuilder } from './gate.js';
import { PhaseBuilder } from './phase.js';

interface ResumeOptions {
  onResume?: 'continue' | 'restart';
}

export class WorkflowBuilder {
  private _name: string;
  private _resumable: boolean = false;
  private _resumeOptions?: ResumeOptions;
  private _orchestrator?: AgentBuilder;
  private _phases: PhaseBuilder[] = [];
  private _currentPhase: PhaseBuilder | null = null;
  private _agents: Map<string, AgentBuilder> = new Map();
  private _queues: Map<string, QueueBuilder> = new Map();
  private _gates: Map<string, GateBuilder> = new Map();
  private _scaling?: ScalingConfig;
  private _preCompact?: PreCompactConfig;

  constructor(name: string) {
    this._name = name;
  }

  resumable(options?: ResumeOptions): this {
    this._resumable = true;
    if (options) {
      this._resumeOptions = options;
    }
    return this;
  }

  orchestrator(agent: AgentBuilder): this {
    this._orchestrator = agent;
    this._agents.set(agent.build().name, agent);
    return this;
  }

  scaling(config: ScalingConfig): this {
    this._scaling = config;
    return this;
  }

  preCompact(config: PreCompactConfig): this {
    this._preCompact = config;
    return this;
  }

  phase(name: string): PhaseBuilder {
    // Finalize previous phase if any
    if (this._currentPhase) {
      this._phases.push(this._currentPhase);
    }
    // Create new phase with back-reference to this workflow
    this._currentPhase = new PhaseBuilder(name, this);
    return this._currentPhase;
  }

  // Internal: register an agent
  registerAgent(agent: AgentBuilder): void {
    this._agents.set(agent.build().name, agent);
  }

  // Internal: register a queue
  registerQueue(queue: QueueBuilder): void {
    this._queues.set(queue.build().name, queue);
  }

  // Internal: register a gate
  registerGate(gate: GateBuilder): void {
    this._gates.set(gate.build().name, gate);
  }

  build(): CompiledWorkflow {
    // Finalize last phase
    if (this._currentPhase) {
      this._phases.push(this._currentPhase);
      this._currentPhase = null;
    }

    // Compile agents
    const agents: Record<string, CompiledAgent> = {};
    for (const [name, builder] of this._agents) {
      agents[name] = builder.build();
    }

    // Compile queues
    const queues: Record<string, CompiledQueue> = {};
    for (const [name, builder] of this._queues) {
      queues[name] = builder.build();
    }

    // Compile gates
    const gates: Record<string, CompiledGate> = {};
    for (const [name, builder] of this._gates) {
      gates[name] = builder.build();
    }

    const result: CompiledWorkflow = {
      name: this._name,
      resumable: this._resumable,
      orchestrator: this._orchestrator?.build().name ?? '',
      agents,
      phases: this._phases.map((p) => p.buildPhase()),
      queues,
      gates,
    };

    if (this._scaling) {
      result.scaling = this._scaling;
    }

    if (this._preCompact) {
      result.preCompact = this._preCompact;
    }

    return result;
  }

  validate(): void {
    if (!this._orchestrator) {
      throw new Error('Workflow must have an orchestrator');
    }

    // Consider current phase in progress
    const allPhases = [...this._phases];
    if (this._currentPhase) {
      allPhases.push(this._currentPhase);
    }

    if (allPhases.length === 0) {
      throw new Error('Workflow must have at least one phase');
    }

    // Check for duplicate phase names
    const names = new Set<string>();
    for (const phase of allPhases) {
      const name = phase.buildPhase().name;
      if (names.has(name)) {
        throw new Error(`Duplicate phase name: ${name}`);
      }
      names.add(name);
    }
  }
}

export function workflow(name: string): WorkflowBuilder {
  return new WorkflowBuilder(name);
}
