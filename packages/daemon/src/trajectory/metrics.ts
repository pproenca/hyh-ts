// packages/daemon/src/trajectory/metrics.ts

export interface WorkflowMetrics {
  totalDuration: number;
  phaseDurations: Record<string, number>;
  taskDurations: Record<string, number>;
  tasksCompleted: number;
  tasksFailed: number;
  tasksRetried: number;
  violationCount: Record<string, number>;
  correctionCount: Record<string, number>;
  humanInterventions: number;
  agentSpawns: number;
  estimatedTokensUsed: number;
}

export class MetricsCollector {
  private readonly startTime: number;
  private tasksCompleted = 0;
  private tasksFailed = 0;
  private tasksRetried = 0;
  private humanInterventions = 0;
  private agentSpawns = 0;
  private estimatedTokensUsed = 0;
  private readonly taskDurations: Record<string, number> = {};
  private readonly phaseDurations: Record<string, number> = {};
  private readonly violationCount: Record<string, number> = {};
  private readonly correctionCount: Record<string, number> = {};

  constructor() {
    this.startTime = Date.now();
  }

  recordTaskComplete(taskId: string, durationMs: number): void {
    this.tasksCompleted++;
    this.taskDurations[taskId] = durationMs;
  }

  recordTaskFailed(_taskId: string): void {
    this.tasksFailed++;
  }

  recordTaskRetry(_taskId: string): void {
    this.tasksRetried++;
  }

  recordViolation(type: string): void {
    this.violationCount[type] = (this.violationCount[type] ?? 0) + 1;
  }

  recordCorrection(type: string): void {
    this.correctionCount[type] = (this.correctionCount[type] ?? 0) + 1;
  }

  recordHumanIntervention(): void {
    this.humanInterventions++;
  }

  recordAgentSpawn(): void {
    this.agentSpawns++;
  }

  recordTokens(count: number): void {
    this.estimatedTokensUsed += count;
  }

  recordPhaseTime(phase: string, durationMs: number): void {
    this.phaseDurations[phase] = (this.phaseDurations[phase] ?? 0) + durationMs;
  }

  export(): WorkflowMetrics {
    return {
      totalDuration: Date.now() - this.startTime,
      phaseDurations: { ...this.phaseDurations },
      taskDurations: { ...this.taskDurations },
      tasksCompleted: this.tasksCompleted,
      tasksFailed: this.tasksFailed,
      tasksRetried: this.tasksRetried,
      violationCount: { ...this.violationCount },
      correctionCount: { ...this.correctionCount },
      humanInterventions: this.humanInterventions,
      agentSpawns: this.agentSpawns,
      estimatedTokensUsed: this.estimatedTokensUsed,
    };
  }
}
