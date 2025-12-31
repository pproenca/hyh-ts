import { describe, it, expect, beforeEach } from 'vitest';
import { MetricsCollector } from './metrics.js';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('recordTaskComplete', () => {
    it('should track completed task count', () => {
      collector.recordTaskComplete('task-1', 5000);
      collector.recordTaskComplete('task-2', 3000);

      const metrics = collector.export();
      expect(metrics.tasksCompleted).toBe(2);
    });

    it('should track task durations', () => {
      collector.recordTaskComplete('task-1', 5000);
      collector.recordTaskComplete('task-2', 3000);

      const metrics = collector.export();
      expect(metrics.taskDurations['task-1']).toBe(5000);
      expect(metrics.taskDurations['task-2']).toBe(3000);
    });
  });

  describe('recordTaskFailed', () => {
    it('should track failed task count', () => {
      collector.recordTaskFailed('task-1');

      const metrics = collector.export();
      expect(metrics.tasksFailed).toBe(1);
    });
  });

  describe('recordViolation', () => {
    it('should count violations by type', () => {
      collector.recordViolation('tdd');
      collector.recordViolation('tdd');
      collector.recordViolation('file-scope');

      const metrics = collector.export();
      expect(metrics.violationCount['tdd']).toBe(2);
      expect(metrics.violationCount['file-scope']).toBe(1);
    });
  });

  describe('recordCorrection', () => {
    it('should count corrections by type', () => {
      collector.recordCorrection('prompt');
      collector.recordCorrection('restart');
      collector.recordCorrection('prompt');

      const metrics = collector.export();
      expect(metrics.correctionCount['prompt']).toBe(2);
      expect(metrics.correctionCount['restart']).toBe(1);
    });
  });

  describe('recordTokens', () => {
    it('should accumulate token estimates', () => {
      collector.recordTokens(1000);
      collector.recordTokens(500);

      const metrics = collector.export();
      expect(metrics.estimatedTokensUsed).toBe(1500);
    });
  });

  describe('export', () => {
    it('should calculate total duration', async () => {
      collector.recordTaskComplete('task-1', 100);
      await new Promise(r => setTimeout(r, 50));

      const metrics = collector.export();
      expect(metrics.totalDuration).toBeGreaterThanOrEqual(50);
    });
  });
});
