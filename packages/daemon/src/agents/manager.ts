// packages/daemon/src/agents/manager.ts
import * as crypto from 'node:crypto';
import { AgentProcess, AgentProcessConfig } from './process.js';
import {
  TaskPacketFactory,
  type TaskPacket,
  type TaskPacketInput,
} from '../managers/task-packet.js';

export interface SpawnSpec {
  agentType: string;
  taskId?: string;
  model: 'haiku' | 'sonnet' | 'opus';
  tools: string[];
  systemPromptPath: string;
  worktreePath?: string;
}

export interface AgentManagerOptions {
  worktreeRoot: string;
  taskPacketFactory?: TaskPacketFactory;
}

export class AgentManager {
  private readonly worktreeRoot: string;
  private readonly agents: Map<string, AgentProcess> = new Map();
  private readonly taskPacketFactory: TaskPacketFactory | undefined;

  constructor(options: AgentManagerOptions | string) {
    // Support both old (string) and new (options) constructor signatures
    if (typeof options === 'string') {
      this.worktreeRoot = options;
      this.taskPacketFactory = undefined;
    } else {
      this.worktreeRoot = options.worktreeRoot;
      this.taskPacketFactory = options.taskPacketFactory;
    }
  }

  /**
   * Creates a task packet for structured task handoff.
   * Returns undefined if no TaskPacketFactory was provided.
   */
  createTaskPacket(input: TaskPacketInput): TaskPacket | undefined {
    return this.taskPacketFactory?.create(input);
  }

  /**
   * Creates a task packet asynchronously, loading dependency artifacts.
   * Returns undefined if no TaskPacketFactory was provided.
   */
  async createTaskPacketAsync(
    input: TaskPacketInput
  ): Promise<TaskPacket | undefined> {
    return this.taskPacketFactory?.createAsync(input);
  }

  generateAgentId(agentType: string, taskId?: string): string {
    const suffix = crypto.randomBytes(4).toString('hex');
    return taskId
      ? `${agentType}-${taskId.slice(0, 4)}-${suffix}`
      : `${agentType}-${suffix}`;
  }

  async spawn(spec: SpawnSpec): Promise<AgentProcess> {
    const agentId = this.generateAgentId(spec.agentType, spec.taskId);
    const sessionId = crypto.randomUUID();

    const config: AgentProcessConfig = {
      agentId,
      model: spec.model,
      sessionId,
      systemPromptPath: spec.systemPromptPath,
      tools: spec.tools,
      cwd: spec.worktreePath ?? this.worktreeRoot,
    };

    const agent = new AgentProcess(config);

    // Wire up event handler to remove agent from map on exit
    agent.on('event', (event: { type: string }) => {
      if (event.type === 'exit') {
        this.agents.delete(agentId);
      }
    });

    this.agents.set(agentId, agent);

    await agent.start();
    return agent;
  }

  async kill(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return;
    }

    await agent.stop();
    this.agents.delete(agentId);
  }

  async killAll(): Promise<void> {
    const killPromises = Array.from(this.agents.keys()).map((id) =>
      this.kill(id)
    );
    await Promise.all(killPromises);
  }

  get(agentId: string): AgentProcess | undefined {
    return this.agents.get(agentId);
  }

  getActiveAgents(): AgentProcess[] {
    return Array.from(this.agents.values()).filter((a) => a.isRunning);
  }
}
