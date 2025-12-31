// packages/daemon/src/index.test.ts
import { describe, it, expect } from 'vitest';
import * as daemon from './index.js';

describe('@hyh/daemon exports', () => {
  describe('Core', () => {
    it('exports Daemon class', () => {
      expect(daemon.Daemon).toBeDefined();
    });

    it('exports EventLoop class', () => {
      expect(daemon.EventLoop).toBeDefined();
    });
  });

  describe('State', () => {
    it('exports StateManager', () => {
      expect(daemon.StateManager).toBeDefined();
    });

    it('exports TaskStatus enum', () => {
      expect(daemon.TaskStatus).toBeDefined();
      expect(daemon.TaskStatus.PENDING).toBe('pending');
      expect(daemon.TaskStatus.RUNNING).toBe('running');
      expect(daemon.TaskStatus.COMPLETED).toBe('completed');
    });
  });

  describe('Trajectory', () => {
    it('exports TrajectoryLogger', () => {
      expect(daemon.TrajectoryLogger).toBeDefined();
    });
  });

  describe('IPC', () => {
    it('exports IPCServer', () => {
      expect(daemon.IPCServer).toBeDefined();
    });

    it('exports IPCClient', () => {
      expect(daemon.IPCClient).toBeDefined();
    });
  });

  describe('Agent Management', () => {
    it('exports AgentManager', () => {
      expect(daemon.AgentManager).toBeDefined();
    });

    it('exports AgentProcess', () => {
      expect(daemon.AgentProcess).toBeDefined();
    });

    it('exports HeartbeatMonitor', () => {
      expect(daemon.HeartbeatMonitor).toBeDefined();
    });
  });

  describe('Checkers', () => {
    it('exports CheckerChain', () => {
      expect(daemon.CheckerChain).toBeDefined();
    });

    it('exports TddChecker', () => {
      expect(daemon.TddChecker).toBeDefined();
    });

    it('exports FileScopeChecker', () => {
      expect(daemon.FileScopeChecker).toBeDefined();
    });

    it('exports NoCodeChecker', () => {
      expect(daemon.NoCodeChecker).toBeDefined();
    });

    it('exports MustProgressChecker', () => {
      expect(daemon.MustProgressChecker).toBeDefined();
    });
  });

  describe('Corrections', () => {
    it('exports CorrectionApplicator', () => {
      expect(daemon.CorrectionApplicator).toBeDefined();
    });
  });

  describe('Workflow', () => {
    it('exports WorkflowLoader', () => {
      expect(daemon.WorkflowLoader).toBeDefined();
    });

    it('exports PhaseManager', () => {
      expect(daemon.PhaseManager).toBeDefined();
    });

    it('exports SpawnTriggerManager', () => {
      expect(daemon.SpawnTriggerManager).toBeDefined();
    });

    it('exports GateExecutor', () => {
      expect(daemon.GateExecutor).toBeDefined();
    });
  });

  describe('Plan', () => {
    it('exports PlanImporter', () => {
      expect(daemon.PlanImporter).toBeDefined();
    });
  });

  describe('Git', () => {
    it('exports WorktreeManager', () => {
      expect(daemon.WorktreeManager).toBeDefined();
    });
  });
});
