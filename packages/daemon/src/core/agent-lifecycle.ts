// packages/daemon/src/core/agent-lifecycle.ts
import type { AgentManager, SpawnSpec as AgentManagerSpawnSpec } from '../agents/manager.js';
import type { StateManager } from '../state/manager.js';
import type { TrajectoryLogger } from '../trajectory/logger.js';
import type { HeartbeatMonitor } from '../agents/heartbeat.js';

/**
 * Simple spawn specification for lifecycle management
 */
export interface SpawnSpec {
  agentName: string;
  model: 'haiku' | 'sonnet' | 'opus';
  taskId?: string;
  tools?: string[];
  systemPromptPath?: string;
}

/**
 * Agent interface for lifecycle tracking
 */
export interface Agent {
  id: string;
  kill: () => void | Promise<void>;
  injectPrompt?: (message: string) => void | Promise<void>;
}

/**
 * Dependencies for AgentLifecycle service
 */
export interface AgentLifecycleDeps {
  agentManager: AgentManager;
  stateManager: StateManager;
  trajectory: TrajectoryLogger;
  heartbeatMonitor: HeartbeatMonitor;
}

/**
 * AgentLifecycle manages the lifecycle of agents:
 * - Spawning agents via AgentManager
 * - Tracking spawned agents
 * - Recording heartbeats
 * - Killing agents
 */
export class AgentLifecycle {
  private readonly agentManager: AgentManager;
  private readonly stateManager: StateManager;
  private readonly trajectory: TrajectoryLogger;
  private readonly heartbeatMonitor: HeartbeatMonitor;
  private readonly agents: Map<string, Agent> = new Map();

  constructor(deps: AgentLifecycleDeps) {
    this.agentManager = deps.agentManager;
    this.stateManager = deps.stateManager;
    this.trajectory = deps.trajectory;
    this.heartbeatMonitor = deps.heartbeatMonitor;
  }

  /**
   * Spawn agents based on specifications
   */
  async spawn(specs: SpawnSpec[]): Promise<void> {
    for (const spec of specs) {
      const fullSpec: AgentManagerSpawnSpec = {
        agentType: spec.agentName,
        model: spec.model,
        tools: spec.tools ?? [],
        systemPromptPath: spec.systemPromptPath ?? '',
        ...(spec.taskId !== undefined && { taskId: spec.taskId }),
      };

      const process = await this.agentManager.spawn(fullSpec);

      // Log spawn event
      await this.trajectory.log({
        type: 'spawn',
        timestamp: Date.now(),
        agentId: process.agentId,
      });
    }
  }

  /**
   * Set/track an agent in the lifecycle manager
   */
  setAgent(agentId: string, agent: Agent): void {
    this.agents.set(agentId, agent);
  }

  /**
   * Get a tracked agent by ID
   */
  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Record a heartbeat for an agent
   */
  recordHeartbeat(agentId: string): void {
    this.heartbeatMonitor.recordHeartbeat(agentId);
  }

  /**
   * Get agents with missed heartbeats
   */
  getOverdueAgents(): Array<{ agentId: string; missCount: number }> {
    return this.heartbeatMonitor.getOverdueAgents();
  }

  /**
   * Kill an agent by ID
   */
  async kill(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      await agent.kill();
      this.agents.delete(agentId);
    }
  }

  /**
   * Kill all tracked agents
   */
  async killAll(): Promise<void> {
    const killPromises = Array.from(this.agents.keys()).map((id) =>
      this.kill(id)
    );
    await Promise.all(killPromises);
  }

  /**
   * Get all tracked agent IDs
   */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }
}
