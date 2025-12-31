// packages/dsl/src/builders/phase.ts
import { CompiledPhase, Checkpoint } from '../types/compiled.js';
import { AgentBuilder } from './agent.js';
import { QueueBuilder } from './queue.js';
import { GateBuilder } from './gate.js';

// Forward reference type for WorkflowBuilder
interface WorkflowBuilderLike {
  phase(name: string): PhaseBuilder;
  build(): unknown;
}

export class PhaseBuilder {
  private _name: string;
  private _workflow: WorkflowBuilderLike;
  private _agent?: string;
  private _queue?: string;
  private _expects: string[] = [];
  private _forbids: string[] = [];
  private _requires: string[] = [];
  private _outputs: string[] = [];
  private _populates?: string;
  private _parallel: boolean | number = false;
  private _gate?: string;
  private _then?: string;
  private _checkpoint?: Checkpoint;

  constructor(name: string, workflow: WorkflowBuilderLike) {
    this._name = name;
    this._workflow = workflow;
  }

  agent(agent: AgentBuilder): this {
    this._agent = agent.build().name;
    return this;
  }

  queue(queue: QueueBuilder): this {
    this._queue = queue.build().name;
    return this;
  }

  expects(...tools: string[]): this {
    this._expects.push(...tools);
    return this;
  }

  forbids(...tools: string[]): this {
    this._forbids.push(...tools);
    return this;
  }

  requires(...artifacts: string[]): this {
    this._requires.push(...artifacts);
    return this;
  }

  output(...artifacts: string[]): this {
    this._outputs.push(...artifacts);
    return this;
  }

  populates(queue: QueueBuilder): this {
    this._populates = queue.build().name;
    return this;
  }

  parallel(count?: number): this {
    this._parallel = count ?? true;
    return this;
  }

  gate(gate: GateBuilder): this {
    this._gate = gate.build().name;
    return this;
  }

  then(queue: QueueBuilder): this {
    this._then = queue.build().name;
    return this;
  }

  checkpoint(checkpoint: Checkpoint): this {
    this._checkpoint = checkpoint;
    return this;
  }

  // Allow chaining back to workflow
  phase(name: string): PhaseBuilder {
    return this._workflow.phase(name);
  }

  build(): CompiledPhase {
    return {
      name: this._name,
      agent: this._agent ?? '',
      queue: this._queue,
      expects: this._expects,
      forbids: this._forbids,
      requires: this._requires,
      outputs: this._outputs,
      populates: this._populates,
      parallel: this._parallel,
      gate: this._gate,
      then: this._then,
      checkpoint: this._checkpoint,
    };
  }
}
