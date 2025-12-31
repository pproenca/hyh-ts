// packages/daemon/src/agents/manager.ts
import * as crypto from 'node:crypto';
import { AgentProcess, AgentProcessConfig } from './process.js';

export interface SpawnSpec {
  agentType: string;
  taskId?: string;
  model: 'haiku' | 'sonnet' | 'opus';
  tools: string[];
  systemPromptPath: string;
}

export class AgentManager {
  private readonly worktreeRoot: string;
  private agents: Map<string, AgentProcess> = new Map();

  constructor(worktreeRoot: string) {
    this.worktreeRoot = worktreeRoot;
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
      cwd: this.worktreeRoot,
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
    if (!agent) return;

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
