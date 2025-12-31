// packages/daemon/src/agents/heartbeat.ts
export interface HeartbeatStatus {
  status: 'ok' | 'miss';
  count?: number;
}

interface AgentHeartbeat {
  interval: number;
  lastHeartbeat: number;
  missCount: number;
}

export class HeartbeatMonitor {
  private agents: Map<string, AgentHeartbeat> = new Map();

  register(agentId: string, interval: number): void {
    this.agents.set(agentId, {
      interval,
      lastHeartbeat: Date.now(),
      missCount: 0,
    });
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  recordHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = Date.now();
      agent.missCount = 0;
    } else {
      // Auto-register with placeholder interval (will be provided at check time)
      this.agents.set(agentId, {
        interval: 0,
        lastHeartbeat: Date.now(),
        missCount: 0,
      });
    }
  }

  check(agentId: string, interval?: number): HeartbeatStatus {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return { status: 'ok' };
    }

    const elapsed = Date.now() - agent.lastHeartbeat;
    const effectiveInterval = interval ?? agent.interval;

    if (elapsed < effectiveInterval) {
      return { status: 'ok' };
    }

    agent.missCount += 1;
    return { status: 'miss', count: agent.missCount };
  }

  getOverdueAgents(): Array<{ agentId: string; missCount: number }> {
    const overdue: Array<{ agentId: string; missCount: number }> = [];

    for (const [agentId, agent] of this.agents) {
      const elapsed = Date.now() - agent.lastHeartbeat;
      if (elapsed >= agent.interval) {
        overdue.push({ agentId, missCount: agent.missCount + 1 });
      }
    }

    return overdue;
  }
}
