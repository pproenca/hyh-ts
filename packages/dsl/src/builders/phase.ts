// packages/dsl/src/builders/phase.ts
import { CompiledPhase, Checkpoint } from '../types/compiled.js';
import { AgentBuilder } from './agent.js';
import { QueueBuilder } from './queue.js';
import { GateBuilder } from './gate.js';
import type { Context } from '../types/context.js';

// Forward reference type for WorkflowBuilder
interface WorkflowBuilderLike {
  phase(name: string): PhaseBuilder;
  registerAgent(agent: AgentBuilder): void;
  registerQueue(queue: QueueBuilder): void;
  registerGate(gate: GateBuilder): void;
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
  private _contextBudget?: number;
  private _onApprove?: string;

  constructor(name: string, workflow: WorkflowBuilderLike) {
    this._name = name;
    this._workflow = workflow;
  }

  agent(agent: AgentBuilder): this {
    this._agent = agent.build().name;
    this._workflow.registerAgent(agent);
    return this;
  }

  queue(queue: QueueBuilder): this {
    this._queue = queue.build().name;
    this._workflow.registerQueue(queue);
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
    this._workflow.registerQueue(queue);
    return this;
  }

  parallel(count?: number): this {
    this._parallel = count ?? true;
    return this;
  }

  gate(gate: GateBuilder): this {
    this._gate = gate.build().name;
    this._workflow.registerGate(gate);
    return this;
  }

  then(queue: QueueBuilder): this {
    this._then = queue.build().name;
    this._workflow.registerQueue(queue);
    return this;
  }

  checkpoint(checkpoint: Checkpoint): this {
    this._checkpoint = checkpoint;
    return this;
  }

  contextBudget(tokens: number): this {
    this._contextBudget = tokens;
    return this;
  }

  onApprove(action: (ctx: Context) => void | Promise<void>): this {
    this._onApprove = action.toString();
    return this;
  }

  // Allow chaining back to workflow
  phase(name: string): PhaseBuilder {
    return this._workflow.phase(name);
  }

  // Build the workflow (delegates to workflow's build)
  build(): ReturnType<WorkflowBuilderLike['build']> {
    return this._workflow.build();
  }

  // Build just this phase (for internal use)
  buildPhase(): CompiledPhase {
    const result: CompiledPhase = {
      name: this._name,
      agent: this._agent ?? '',
      expects: this._expects,
      forbids: this._forbids,
      requires: this._requires,
      outputs: this._outputs,
      parallel: this._parallel,
    };
    if (this._queue) {
      result.queue = this._queue;
    }
    if (this._populates) {
      result.populates = this._populates;
    }
    if (this._gate) {
      result.gate = this._gate;
    }
    if (this._then) {
      result.then = this._then;
    }
    if (this._checkpoint) {
      result.checkpoint = this._checkpoint;
    }
    if (this._contextBudget !== undefined) {
      result.contextBudget = this._contextBudget;
    }
    if (this._onApprove) {
      result.onApprove = this._onApprove;
    }
    return result;
  }
}
