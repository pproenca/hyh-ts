// packages/daemon/src/managers/reinjection.ts
// ReinjectionManager: Tracks tool use counts per agent and returns templated
// reminder messages when threshold is reached. Implements the anti-abandonment
// pattern to periodically remind agents of their objectives.

/**
 * Context passed to the reinjection template function.
 * Contains objective, incomplete todos, and extensible custom properties.
 */
export interface ReinjectionContext {
  /** The agent's current objective */
  objective: string;
  /** Optional list of incomplete todo items */
  todoIncomplete?: string[];
  /** Extensible: allow additional custom properties */
  [key: string]: unknown;
}

/**
 * Configuration options for ReinjectionManager.
 */
export interface ReinjectionOptions {
  /** Number of tool uses between reinjections */
  every: number;
  /** Template function that generates the reminder message */
  template: (context: ReinjectionContext) => string;
}

/**
 * Manages periodic task reminder injections for agents.
 * Tracks tool use counts per agent and triggers reminders at configured intervals.
 */
export class ReinjectionManager {
  private readonly options: ReinjectionOptions;
  private readonly counts: Map<string, number> = new Map();

  constructor(options: ReinjectionOptions) {
    this.options = options;
  }

  /**
   * Called when an agent uses a tool. Returns a reminder message when
   * the tool use count reaches the configured threshold, null otherwise.
   */
  onToolUse(agentId: string, context: ReinjectionContext): string | null {
    const currentCount = this.counts.get(agentId) ?? 0;
    const newCount = currentCount + 1;
    this.counts.set(agentId, newCount);

    if (newCount % this.options.every === 0) {
      return this.options.template(context);
    }

    return null;
  }

  /**
   * Resets the tool use count for an agent.
   */
  reset(agentId: string): void {
    this.counts.set(agentId, 0);
  }

  /**
   * Gets the current tool use count for an agent.
   */
  getCount(agentId: string): number {
    return this.counts.get(agentId) ?? 0;
  }
}
