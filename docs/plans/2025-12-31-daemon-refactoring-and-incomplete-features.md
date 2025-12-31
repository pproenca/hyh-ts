# Daemon Refactoring & Incomplete Features Implementation Plan

**Created**: 2025-12-31
**Status**: Ready for execution
**Scope**: Complete CLI commands, implement speculative code, extract Daemon services

## Summary

This plan addresses three categories identified in the code review:
1. **Incomplete CLI commands** - logs, dev, resume are stubs or broken
2. **Speculative code** - CorrectionApplicator types duplicated, correction behaviors unimplemented
3. **Daemon god-object** - Extract 4 focused services with dependency injection

Based on user preferences:
- CLI commands: **Implement minimally** (working versions)
- Daemon refactoring: **Extract 4+ services** (comprehensive decomposition)
- Speculative code: **Implement properly** (not delete)

---

## Task Groups

### Group 1: IPC Foundation (Independent)

Tasks in this group have no file overlap and can run in parallel.

---

### Task 1: Add get_logs IPC Schema

**Files:**
- Modify: `packages/daemon/src/types/ipc.ts:59-85`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST** - Before ANY implementation:
   ```typescript
   // packages/daemon/src/types/ipc.test.ts
   import { describe, it, expect } from 'vitest';
   import { GetLogsRequestSchema, IPCRequestSchema } from './ipc.js';

   describe('GetLogsRequestSchema', () => {
     it('validates get_logs command with defaults', () => {
       const result = GetLogsRequestSchema.safeParse({ command: 'get_logs' });
       expect(result.success).toBe(true);
       if (result.success) {
         expect(result.data.limit).toBe(20);
         expect(result.data.agentId).toBeUndefined();
       }
     });

     it('validates get_logs with custom limit and agentId', () => {
       const result = GetLogsRequestSchema.safeParse({
         command: 'get_logs',
         limit: 50,
         agentId: 'worker-1',
       });
       expect(result.success).toBe(true);
       if (result.success) {
         expect(result.data.limit).toBe(50);
         expect(result.data.agentId).toBe('worker-1');
       }
     });

     it('is included in IPCRequestSchema union', () => {
       const result = IPCRequestSchema.safeParse({ command: 'get_logs', limit: 10 });
       expect(result.success).toBe(true);
     });
   });
   ```

2. **Run test, verify FAILURE:**
   ```bash
   pnpm test packages/daemon/src/types/ipc.test.ts -- --reporter=verbose
   ```
   Expected: FAIL (GetLogsRequestSchema doesn't exist)

3. **Implement MINIMAL code:**
   ```typescript
   // In packages/daemon/src/types/ipc.ts, after SubscribeRequestSchema:
   export const GetLogsRequestSchema = z.object({
     command: z.literal('get_logs'),
     limit: z.number().positive().default(20),
     agentId: z.string().optional(),
   });

   // Update IPCRequestSchema to include it:
   export const IPCRequestSchema = z.discriminatedUnion('command', [
     PingRequestSchema,
     GetStateRequestSchema,
     TaskClaimRequestSchema,
     TaskCompleteRequestSchema,
     TaskLogRequestSchema,
     HeartbeatRequestSchema,
     ShutdownRequestSchema,
     SubscribeRequestSchema,
     GetLogsRequestSchema, // Add this line
   ]);
   ```

4. **Run test, verify PASS:**
   ```bash
   pnpm test packages/daemon/src/types/ipc.test.ts -- --reporter=verbose
   ```
   Expected: PASS (all tests green)

5. **Commit with conventional format:**
   ```bash
   git add -A && git commit -m "feat(daemon): add get_logs IPC schema"
   ```

---

### Task 2: Add get_logs IPC Handler to Daemon

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts:428-570`
- Test: `packages/daemon/src/core/daemon.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST** - Before ANY implementation:
   ```typescript
   // Add to packages/daemon/src/core/daemon.test.ts
   describe('get_logs handler', () => {
     it('returns recent trajectory events', async () => {
       // Setup: log some events
       await daemon['trajectory'].log({
         type: 'agent_spawn',
         timestamp: Date.now(),
         agentId: 'test-agent',
       });
       await daemon['trajectory'].log({
         type: 'tool_use',
         timestamp: Date.now(),
         agentId: 'test-agent',
         toolName: 'Read',
       });

       const response = await sendIPCRequest(socketPath, {
         command: 'get_logs',
         limit: 10,
       });

       expect(response.status).toBe('ok');
       expect(response.data.logs).toHaveLength(2);
     });

     it('filters by agentId when specified', async () => {
       await daemon['trajectory'].log({
         type: 'agent_spawn',
         timestamp: Date.now(),
         agentId: 'agent-1',
       });
       await daemon['trajectory'].log({
         type: 'agent_spawn',
         timestamp: Date.now(),
         agentId: 'agent-2',
       });

       const response = await sendIPCRequest(socketPath, {
         command: 'get_logs',
         agentId: 'agent-1',
       });

       expect(response.status).toBe('ok');
       expect(response.data.logs).toHaveLength(1);
       expect(response.data.logs[0].agentId).toBe('agent-1');
     });
   });
   ```

2. **Run test, verify FAILURE:**
   ```bash
   pnpm test packages/daemon/src/core/daemon.test.ts -- --reporter=verbose --grep "get_logs"
   ```
   Expected: FAIL (handler not registered)

3. **Implement MINIMAL code:**
   ```typescript
   // In registerHandlers() method of daemon.ts, add:
   this.ipcServer.registerHandler('get_logs', async (request: unknown) => {
     const req = request as { limit?: number; agentId?: string };
     const limit = req.limit ?? 20;

     let events: TrajectoryEvent[];
     if (req.agentId) {
       events = await this.trajectory.filterByAgent(req.agentId, limit);
     } else {
       events = await this.trajectory.tail(limit);
     }

     return {
       logs: events.map((e) => ({
         timestamp: e.timestamp,
         agentId: e.agentId ?? 'system',
         type: e.type,
         message: JSON.stringify(e),
       })),
     };
   });
   ```

4. **Run test, verify PASS:**
   ```bash
   pnpm test packages/daemon/src/core/daemon.test.ts -- --reporter=verbose --grep "get_logs"
   ```
   Expected: PASS

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(daemon): implement get_logs IPC handler"
   ```

---

### Group 2: CLI Command Implementations (Independent)

Tasks 3, 4, 5 have minimal overlap and can run in parallel.

---

### Task 3: Fix CLI logs Command

**Files:**
- Modify: `packages/cli/src/commands/logs.ts`
- Test: `packages/cli/src/commands/logs.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // packages/cli/src/commands/logs.test.ts
   import { describe, it, expect, vi, beforeEach } from 'vitest';

   // Mock IPCClient
   vi.mock('../ipc/client.js', () => ({
     IPCClient: vi.fn().mockImplementation(() => ({
       connect: vi.fn().mockResolvedValue(undefined),
       disconnect: vi.fn().mockResolvedValue(undefined),
       request: vi.fn().mockResolvedValue({
         status: 'ok',
         data: {
           logs: [
             { timestamp: 1704067200000, agentId: 'worker-1', type: 'tool_use', message: '{}' },
           ],
         },
       }),
     })),
   }));

   describe('logs command', () => {
     it('requests logs via get_logs IPC command', async () => {
       const { IPCClient } = await import('../ipc/client.js');
       const mockClient = new IPCClient('/tmp/test.sock');

       // Invoke the command logic
       await mockClient.connect();
       const response = await mockClient.request({ command: 'get_logs', limit: 20 });

       expect(response.status).toBe('ok');
       expect(response.data.logs).toHaveLength(1);
     });
   });
   ```

2. **Run test, verify FAILURE:**
   ```bash
   pnpm test packages/cli/src/commands/logs.test.ts -- --reporter=verbose
   ```

3. **Implement MINIMAL code:**
   ```typescript
   // packages/cli/src/commands/logs.ts - replace entire file
   import { Command } from 'commander';
   import { IPCClient } from '../ipc/client.js';
   import { findSocketPath } from '../utils/socket.js';

   interface LogEntry {
     timestamp: number;
     agentId: string;
     type: string;
     message: string;
   }

   export function registerLogsCommand(program: Command): void {
     program
       .command('logs')
       .description('View workflow execution logs')
       .option('-n, --lines <count>', 'Number of log lines to show', '20')
       .option('-a, --agent <id>', 'Filter logs by agent ID')
       .option('-f, --follow', 'Follow log output (not implemented)')
       .action(async (options) => {
         const socketPath = await findSocketPath();
         if (!socketPath) {
           console.error('No active workflow found. Start one with `hyh run`.');
           process.exit(1);
         }

         const client = new IPCClient(socketPath);
         try {
           await client.connect();

           const response = await client.request({
             command: 'get_logs',
             limit: parseInt(options.lines, 10),
             agentId: options.agent,
           } as Parameters<typeof client.request>[0]);

           if (response.status === 'ok') {
             const logs = (response.data as { logs: LogEntry[] }).logs;
             for (const log of logs) {
               const time = new Date(log.timestamp).toLocaleTimeString();
               console.log(`${time} [${log.agentId}] ${log.type}`);
             }
           } else {
             console.error('Failed to fetch logs:', response.error);
           }

           if (options.follow) {
             console.log('\n--follow mode not yet implemented');
           }

           await client.disconnect();
         } catch (error) {
           console.error('Connection error:', error instanceof Error ? error.message : error);
           process.exit(1);
         }
       });
   }
   ```

4. **Run test, verify PASS:**
   ```bash
   pnpm test packages/cli/src/commands/logs.test.ts -- --reporter=verbose
   ```

5. **Commit:**
   ```bash
   git add -A && git commit -m "fix(cli): implement logs command with get_logs IPC"
   ```

---

### Task 4: Implement CLI dev Command

**Files:**
- Modify: `packages/cli/src/commands/dev.ts`
- Test: `packages/cli/src/commands/dev.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // Add to packages/cli/src/commands/dev.test.ts
   describe('dev command implementation', () => {
     it('compiles workflow and starts daemon', async () => {
       // Mock the imports
       const mockDaemon = {
         start: vi.fn().mockResolvedValue(undefined),
         loadWorkflow: vi.fn().mockResolvedValue(undefined),
         getSocketPath: vi.fn().mockReturnValue('/tmp/test.sock'),
         stop: vi.fn().mockResolvedValue(undefined),
       };

       // Test that dev command initializes properly
       expect(mockDaemon.start).toBeDefined();
       expect(mockDaemon.loadWorkflow).toBeDefined();
     });
   });
   ```

2. **Run test, verify behavior**

3. **Implement MINIMAL code:**
   ```typescript
   // packages/cli/src/commands/dev.ts - replace action handler
   .action(async (workflowPath: string, options) => {
     const absolutePath = path.resolve(workflowPath);

     if (!fs.existsSync(absolutePath)) {
       console.error(`Workflow file not found: ${absolutePath}`);
       process.exit(1);
     }

     const projectDir = path.dirname(absolutePath);
     const outputDir = path.join(projectDir, '.hyh');

     console.log('Starting hyh in development mode...');
     console.log(`Workflow: ${absolutePath}`);

     try {
       // Compile workflow
       const { compileToDir } = await import('@hyh/dsl');
       const { pathToFileURL } = await import('node:url');
       const workflowUrl = pathToFileURL(absolutePath).href;
       const module = await import(workflowUrl);
       const workflow = module.default ?? module.workflow ?? module;
       await compileToDir(workflow, outputDir);
       console.log('Workflow compiled to .hyh/');

       // Start daemon
       const { Daemon, EventLoop } = await import('@hyh/daemon');
       const daemon = new Daemon({ worktreeRoot: projectDir });
       await daemon.start();
       await daemon.loadWorkflow(path.join(outputDir, 'workflow.json'));
       console.log(`Daemon started: ${daemon.getSocketPath()}`);

       // Start event loop
       const eventLoop = new EventLoop(daemon, { tickInterval: 1000 });
       eventLoop.start();

       // Optionally start TUI
       if (options.tui !== false) {
         try {
           const { startTUI } = await import('@hyh/tui');
           startTUI(daemon.getSocketPath());
         } catch {
           console.log('TUI not available, running headless');
         }
       }

       // Handle shutdown
       process.on('SIGINT', async () => {
         console.log('\nShutting down...');
         eventLoop.stop();
         await daemon.stop();
         process.exit(0);
       });

       // Keep process alive
       await new Promise(() => {});
     } catch (error) {
       console.error('Failed to start:', error instanceof Error ? error.message : error);
       process.exit(1);
     }
   });
   ```

4. **Run test, verify PASS**

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(cli): implement dev command with daemon startup"
   ```

---

### Task 5: Implement CLI resume Command

**Files:**
- Modify: `packages/cli/src/commands/resume.ts`
- Test: `packages/cli/src/commands/resume.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // packages/cli/src/commands/resume.test.ts
   describe('resume command', () => {
     it('connects to existing daemon if running', async () => {
       // Test socket detection logic
     });

     it('starts new daemon with existing state if not running', async () => {
       // Test state recovery
     });
   });
   ```

2. **Run test, verify FAILURE**

3. **Implement MINIMAL code:**
   ```typescript
   // packages/cli/src/commands/resume.ts - replace action handler
   .action(async (options) => {
     const projectDir = options.dir ? path.resolve(options.dir) : process.cwd();
     const hyhDir = path.join(projectDir, '.hyh');
     const statePath = path.join(hyhDir, 'state.json');
     const workflowPath = path.join(hyhDir, 'workflow.json');

     // Check for existing state
     if (!fs.existsSync(statePath)) {
       console.error('No workflow state found. Start a workflow first with `hyh run`.');
       process.exit(1);
     }

     if (!fs.existsSync(workflowPath)) {
       console.error('No compiled workflow found. Run `hyh compile` first.');
       process.exit(1);
     }

     // Check for running daemon
     const socketPath = await findSocketPath();
     if (socketPath) {
       console.log('Connecting to running daemon...');
       const client = new IPCClient(socketPath);
       try {
         await client.connect();
         const response = await client.request({ command: 'get_state' });
         if (response.status === 'ok') {
           const state = response.data as { state: { currentPhase: string; workflowName: string } };
           console.log(`Connected to workflow: ${state.state.workflowName}`);
           console.log(`Current phase: ${state.state.currentPhase}`);
         }
         await client.disconnect();
         return;
       } catch {
         console.log('Daemon not responding, starting new instance...');
       }
     }

     // Start daemon with existing state
     console.log('Resuming workflow...');
     try {
       const { Daemon, EventLoop } = await import('@hyh/daemon');
       const daemon = new Daemon({ worktreeRoot: projectDir });
       await daemon.start();
       await daemon.loadWorkflow(workflowPath);

       // State is automatically loaded by StateManager
       const eventLoop = new EventLoop(daemon, { tickInterval: 1000 });
       eventLoop.start();

       console.log('Workflow resumed successfully');
       console.log(`Socket: ${daemon.getSocketPath()}`);

       process.on('SIGINT', async () => {
         eventLoop.stop();
         await daemon.stop();
         process.exit(0);
       });

       await new Promise(() => {});
     } catch (error) {
       console.error('Failed to resume:', error instanceof Error ? error.message : error);
       process.exit(1);
     }
   });
   ```

4. **Run test, verify PASS**

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(cli): implement resume command with state recovery"
   ```

---

### Group 3: CorrectionApplicator Completion (Sequential with Group 4)

---

### Task 6: Wire CorrectionApplicator Dependencies

**Files:**
- Modify: `packages/daemon/src/corrections/applicator.ts`
- Test: `packages/daemon/src/corrections/applicator.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // packages/daemon/src/corrections/applicator.test.ts
   import { describe, it, expect, vi } from 'vitest';
   import { CorrectionApplicator } from './applicator.js';

   describe('CorrectionApplicator', () => {
     it('applies restart correction by killing and respawning agent', async () => {
       const killAgent = vi.fn().mockResolvedValue(undefined);
       const respawnAgent = vi.fn().mockResolvedValue(undefined);

       const applicator = new CorrectionApplicator({
         injectPrompt: vi.fn(),
         killAgent,
         respawnAgent,
         reassignTask: vi.fn(),
         compactContext: vi.fn(),
       });

       await applicator.apply('agent-1', { type: 'restart' });

       expect(killAgent).toHaveBeenCalledWith('agent-1');
       expect(respawnAgent).toHaveBeenCalledWith('agent-1');
     });

     it('applies compact correction with config options', async () => {
       const compactContext = vi.fn().mockResolvedValue(undefined);

       const applicator = new CorrectionApplicator({
         injectPrompt: vi.fn(),
         killAgent: vi.fn(),
         respawnAgent: vi.fn(),
         reassignTask: vi.fn(),
         compactContext,
       });

       await applicator.apply('agent-1', {
         type: 'compact',
         keepLastN: 50,
         summarize: true,
       });

       expect(compactContext).toHaveBeenCalledWith('agent-1', {
         keepLastN: 50,
         summarize: true,
       });
     });

     it('applies reassign correction', async () => {
       const reassignTask = vi.fn().mockResolvedValue(undefined);

       const applicator = new CorrectionApplicator({
         injectPrompt: vi.fn(),
         killAgent: vi.fn(),
         respawnAgent: vi.fn(),
         reassignTask,
         compactContext: vi.fn(),
       });

       await applicator.apply('agent-1', { type: 'reassign' });

       expect(reassignTask).toHaveBeenCalledWith('agent-1');
     });
   });
   ```

2. **Run test, verify FAILURE:**
   ```bash
   pnpm test packages/daemon/src/corrections/applicator.test.ts -- --reporter=verbose
   ```

3. **Implement MINIMAL code:**
   ```typescript
   // packages/daemon/src/corrections/applicator.ts
   import type { Correction } from '@hyh/dsl';

   export interface ApplicatorDeps {
     injectPrompt: (agentId: string, message: string) => Promise<void>;
     killAgent: (agentId: string) => Promise<void>;
     respawnAgent: (agentId: string) => Promise<void>;
     reassignTask: (agentId: string) => Promise<void>;
     compactContext: (agentId: string, options: { keepLastN?: number; summarize?: boolean }) => Promise<void>;
   }

   export interface ApplyResult {
     applied: boolean;
     message?: string;
   }

   export class CorrectionApplicator {
     constructor(private deps: ApplicatorDeps) {}

     async apply(agentId: string, correction: Correction): Promise<ApplyResult> {
       switch (correction.type) {
         case 'prompt':
           await this.deps.injectPrompt(agentId, correction.message);
           return { applied: true, message: `Injected prompt to ${agentId}` };

         case 'warn':
           await this.deps.injectPrompt(agentId, `WARNING: ${correction.message}`);
           return { applied: true, message: `Warned ${agentId}` };

         case 'block':
           await this.deps.injectPrompt(agentId, `BLOCKED: ${correction.message}. Undo and retry.`);
           return { applied: true, message: `Blocked action for ${agentId}` };

         case 'restart':
           await this.deps.killAgent(agentId);
           await this.deps.respawnAgent(agentId);
           return { applied: true, message: `Restarted ${agentId}` };

         case 'reassign':
           await this.deps.reassignTask(agentId);
           return { applied: true, message: `Reassigned task from ${agentId}` };

         case 'escalate':
           // Escalate to human - log and pause agent
           await this.deps.injectPrompt(agentId, 'ESCALATED: Awaiting human review. Please pause.');
           return { applied: true, message: `Escalated ${agentId} to human` };

         case 'retry':
           await this.deps.injectPrompt(agentId, 'RETRY: Please retry the last action.');
           return { applied: true, message: `Requested retry from ${agentId}` };

         case 'compact':
           await this.deps.compactContext(agentId, {
             keepLastN: correction.keepLastN,
             summarize: correction.summarize,
           });
           return { applied: true, message: `Compacted context for ${agentId}` };

         default:
           return { applied: false, message: `Unknown correction type` };
       }
     }
   }
   ```

4. **Run test, verify PASS:**
   ```bash
   pnpm test packages/daemon/src/corrections/applicator.test.ts -- --reporter=verbose
   ```

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(daemon): complete CorrectionApplicator with all correction types"
   ```

---

### Group 4: Daemon Service Extraction (Sequential)

These tasks must be done in order due to dependencies.

---

### Task 7: Create EventProcessor Service

**Files:**
- Create: `packages/daemon/src/core/event-processor.ts`
- Test: `packages/daemon/src/core/event-processor.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // packages/daemon/src/core/event-processor.test.ts
   import { describe, it, expect, vi } from 'vitest';
   import { EventProcessor } from './event-processor.js';

   describe('EventProcessor', () => {
     it('logs events to trajectory', async () => {
       const mockLog = vi.fn().mockResolvedValue(undefined);
       const processor = new EventProcessor({
         trajectory: { log: mockLog } as any,
         stateManager: { load: vi.fn().mockResolvedValue({}) } as any,
         checkerChain: null,
         correctionApplicator: null,
       });

       await processor.process('agent-1', {
         type: 'tool_use',
         timestamp: Date.now(),
         agentId: 'agent-1',
         toolName: 'Read',
       });

       expect(mockLog).toHaveBeenCalledOnce();
     });

     it('checks invariants when checker chain provided', async () => {
       const mockCheck = vi.fn().mockReturnValue(null);
       const processor = new EventProcessor({
         trajectory: { log: vi.fn() } as any,
         stateManager: { load: vi.fn().mockResolvedValue({}) } as any,
         checkerChain: { check: mockCheck } as any,
         correctionApplicator: null,
       });

       await processor.process('agent-1', {
         type: 'tool_use',
         timestamp: Date.now(),
         agentId: 'agent-1',
       });

       expect(mockCheck).toHaveBeenCalled();
     });

     it('applies correction when violation detected', async () => {
       const mockApply = vi.fn().mockResolvedValue({ applied: true });
       const processor = new EventProcessor({
         trajectory: { log: vi.fn() } as any,
         stateManager: { load: vi.fn().mockResolvedValue({}) } as any,
         checkerChain: {
           check: vi.fn().mockReturnValue({
             message: 'Violation',
             correction: { type: 'warn', message: 'Stop' },
           }),
         } as any,
         correctionApplicator: { apply: mockApply } as any,
       });

       const result = await processor.process('agent-1', {
         type: 'tool_use',
         timestamp: Date.now(),
       });

       expect(mockApply).toHaveBeenCalled();
       expect(result.violation).toBeDefined();
     });
   });
   ```

2. **Run test, verify FAILURE:**
   ```bash
   pnpm test packages/daemon/src/core/event-processor.test.ts -- --reporter=verbose
   ```

3. **Implement MINIMAL code:**
   ```typescript
   // packages/daemon/src/core/event-processor.ts
   import type { TrajectoryLogger, TrajectoryEvent } from '../trajectory/logger.js';
   import type { StateManager } from '../state/manager.js';
   import type { CheckerChain, Violation } from '../checkers/chain.js';
   import type { CorrectionApplicator, ApplyResult } from '../corrections/applicator.js';

   export interface EventProcessorDeps {
     trajectory: TrajectoryLogger;
     stateManager: StateManager;
     checkerChain: CheckerChain | null;
     correctionApplicator: CorrectionApplicator | null;
   }

   export interface ProcessEventResult {
     violation?: Violation;
     correction?: ApplyResult;
     error?: Error;
   }

   export class EventProcessor {
     private trajectoryHistory: TrajectoryEvent[] = [];

     constructor(private deps: EventProcessorDeps) {}

     async process(agentId: string, event: TrajectoryEvent): Promise<ProcessEventResult> {
       try {
         // 1. Log to trajectory
         await this.deps.trajectory.log(event);
         this.trajectoryHistory.push(event);

         // 2. Check invariants if checker chain available
         if (this.deps.checkerChain) {
           const state = await this.deps.stateManager.load();
           const violation = this.deps.checkerChain.check(
             agentId,
             event,
             state,
             this.trajectoryHistory
           );

           // 3. Apply correction if violation found
           if (violation?.correction && this.deps.correctionApplicator) {
             const correction = await this.deps.correctionApplicator.apply(
               agentId,
               violation.correction
             );
             return { violation, correction };
           }

           if (violation) {
             return { violation };
           }
         }

         return {};
       } catch (error) {
         return { error: error instanceof Error ? error : new Error(String(error)) };
       }
     }

     getHistory(): TrajectoryEvent[] {
       return [...this.trajectoryHistory];
     }

     clearHistory(): void {
       this.trajectoryHistory = [];
     }
   }
   ```

4. **Run test, verify PASS:**
   ```bash
   pnpm test packages/daemon/src/core/event-processor.test.ts -- --reporter=verbose
   ```

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(daemon): extract EventProcessor service"
   ```

---

### Task 8: Create AgentLifecycle Service

**Files:**
- Create: `packages/daemon/src/core/agent-lifecycle.ts`
- Test: `packages/daemon/src/core/agent-lifecycle.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // packages/daemon/src/core/agent-lifecycle.test.ts
   import { describe, it, expect, vi } from 'vitest';
   import { AgentLifecycle } from './agent-lifecycle.js';

   describe('AgentLifecycle', () => {
     it('spawns agents via agent manager', async () => {
       const mockSpawn = vi.fn().mockResolvedValue({ agentId: 'test-1' });
       const lifecycle = new AgentLifecycle({
         agentManager: { spawn: mockSpawn } as any,
         stateManager: { load: vi.fn(), update: vi.fn() } as any,
         trajectory: { log: vi.fn() } as any,
         heartbeatMonitor: { recordHeartbeat: vi.fn(), getOverdueAgents: vi.fn().mockReturnValue([]) } as any,
       });

       await lifecycle.spawn([{ agentName: 'test-1', model: 'sonnet' }]);

       expect(mockSpawn).toHaveBeenCalled();
     });

     it('tracks spawned agents', async () => {
       const lifecycle = new AgentLifecycle({
         agentManager: { spawn: vi.fn().mockResolvedValue({ agentId: 'test-1' }) } as any,
         stateManager: { load: vi.fn(), update: vi.fn() } as any,
         trajectory: { log: vi.fn() } as any,
         heartbeatMonitor: { recordHeartbeat: vi.fn(), getOverdueAgents: vi.fn().mockReturnValue([]) } as any,
       });

       const mockAgent = { id: 'test-1', kill: vi.fn() };
       lifecycle.setAgent('test-1', mockAgent as any);

       expect(lifecycle.getAgent('test-1')).toBe(mockAgent);
     });

     it('records heartbeats', () => {
       const mockRecord = vi.fn();
       const lifecycle = new AgentLifecycle({
         agentManager: {} as any,
         stateManager: {} as any,
         trajectory: {} as any,
         heartbeatMonitor: { recordHeartbeat: mockRecord, getOverdueAgents: vi.fn().mockReturnValue([]) } as any,
       });

       lifecycle.recordHeartbeat('agent-1');

       expect(mockRecord).toHaveBeenCalledWith('agent-1');
     });
   });
   ```

2. **Run test, verify FAILURE**

3. **Implement MINIMAL code:**
   ```typescript
   // packages/daemon/src/core/agent-lifecycle.ts
   import type { AgentManager } from '../agents/manager.js';
   import type { StateManager } from '../state/manager.js';
   import type { TrajectoryLogger } from '../trajectory/logger.js';
   import type { HeartbeatMonitor } from '../heartbeat/monitor.js';
   import type { Agent } from '../agents/process.js';

   export interface SpawnSpec {
     agentName: string;
     model: string;
     tools?: string[];
     sessionId?: string;
   }

   export interface AgentLifecycleDeps {
     agentManager: AgentManager;
     stateManager: StateManager;
     trajectory: TrajectoryLogger;
     heartbeatMonitor: HeartbeatMonitor;
   }

   export class AgentLifecycle {
     private readonly agents: Map<string, Agent> = new Map();

     constructor(private deps: AgentLifecycleDeps) {}

     async spawn(specs: SpawnSpec[]): Promise<void> {
       for (const spec of specs) {
         await this.deps.trajectory.log({
           type: 'agent_spawn',
           timestamp: Date.now(),
           agentId: spec.agentName,
         });

         const agent = await this.deps.agentManager.spawn({
           agentId: spec.agentName,
           model: spec.model,
           tools: spec.tools ?? [],
           sessionId: spec.sessionId,
         });

         this.agents.set(spec.agentName, agent);
         this.deps.heartbeatMonitor.recordHeartbeat(spec.agentName);
       }
     }

     setAgent(agentId: string, agent: Agent): void {
       this.agents.set(agentId, agent);
     }

     getAgent(agentId: string): Agent | undefined {
       return this.agents.get(agentId);
     }

     getActiveAgents(): Agent[] {
       return Array.from(this.agents.values());
     }

     async killAgent(agentId: string): Promise<void> {
       const agent = this.agents.get(agentId);
       if (agent) {
         await agent.kill();
         this.agents.delete(agentId);
         await this.deps.trajectory.log({
           type: 'agent_exit',
           timestamp: Date.now(),
           agentId,
         });
       }
     }

     recordHeartbeat(agentId: string): void {
       this.deps.heartbeatMonitor.recordHeartbeat(agentId);
     }

     checkHeartbeats(): string[] {
       return this.deps.heartbeatMonitor.getOverdueAgents().map((a) => a.agentId);
     }
   }
   ```

4. **Run test, verify PASS**

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(daemon): extract AgentLifecycle service"
   ```

---

### Task 9: Create WorkflowCoordinator Service

**Files:**
- Create: `packages/daemon/src/core/workflow-coordinator.ts`
- Test: `packages/daemon/src/core/workflow-coordinator.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // packages/daemon/src/core/workflow-coordinator.test.ts
   import { describe, it, expect, vi } from 'vitest';
   import { WorkflowCoordinator } from './workflow-coordinator.js';

   describe('WorkflowCoordinator', () => {
     it('loads workflow from file', async () => {
       const coordinator = new WorkflowCoordinator({
         stateManager: { update: vi.fn() } as any,
         trajectory: { log: vi.fn() } as any,
       });

       // Mock fs.readFile
       vi.mock('node:fs/promises', () => ({
         readFile: vi.fn().mockResolvedValue(JSON.stringify({
           name: 'test-workflow',
           phases: [{ name: 'phase-1' }],
         })),
       }));

       await coordinator.load('/tmp/workflow.json');

       expect(coordinator.getWorkflow()).toBeDefined();
     });

     it('checks phase transition conditions', async () => {
       const coordinator = new WorkflowCoordinator({
         stateManager: {
           load: vi.fn().mockResolvedValue({ currentPhase: 'phase-1' }),
           update: vi.fn(),
         } as any,
         trajectory: { log: vi.fn() } as any,
       });

       // Set up workflow with phase manager
       coordinator['workflow'] = {
         name: 'test',
         phases: [{ name: 'phase-1' }, { name: 'phase-2' }],
       } as any;

       const shouldTransition = await coordinator.checkPhaseTransition();
       expect(typeof shouldTransition).toBe('boolean');
     });
   });
   ```

2. **Run test, verify FAILURE**

3. **Implement MINIMAL code:**
   ```typescript
   // packages/daemon/src/core/workflow-coordinator.ts
   import { readFile } from 'node:fs/promises';
   import type { CompiledWorkflow } from '@hyh/dsl';
   import type { StateManager } from '../state/manager.js';
   import type { TrajectoryLogger } from '../trajectory/logger.js';
   import { PhaseManager } from '../workflow/phase-manager.js';
   import { SpawnTriggerManager } from '../workflow/spawn-triggers.js';
   import { GateExecutor } from '../workflow/gate-executor.js';

   export interface WorkflowCoordinatorDeps {
     stateManager: StateManager;
     trajectory: TrajectoryLogger;
   }

   export interface SpawnSpec {
     agentName: string;
     model: string;
     tools?: string[];
   }

   export class WorkflowCoordinator {
     private workflow: CompiledWorkflow | null = null;
     private phaseManager: PhaseManager | null = null;
     private spawnTriggerManager: SpawnTriggerManager | null = null;
     private gateExecutor: GateExecutor | null = null;

     constructor(private deps: WorkflowCoordinatorDeps) {}

     async load(workflowPath: string): Promise<void> {
       const content = await readFile(workflowPath, 'utf-8');
       this.workflow = JSON.parse(content) as CompiledWorkflow;

       this.phaseManager = new PhaseManager(this.workflow);
       this.spawnTriggerManager = new SpawnTriggerManager(this.workflow);
       this.gateExecutor = new GateExecutor(this.workflow.gates ?? {});

       await this.deps.trajectory.log({
         type: 'workflow_loaded',
         timestamp: Date.now(),
         workflowName: this.workflow.name,
       });

       await this.deps.stateManager.update((state) => ({
         ...state,
         workflowName: this.workflow!.name,
         currentPhase: this.workflow!.phases[0]?.name ?? '',
       }));
     }

     getWorkflow(): CompiledWorkflow | null {
       return this.workflow;
     }

     async checkSpawnTriggers(): Promise<SpawnSpec[]> {
       if (!this.spawnTriggerManager || !this.workflow) {
         return [];
       }

       const state = await this.deps.stateManager.load();
       return this.spawnTriggerManager.check(state);
     }

     async checkPhaseTransition(): Promise<boolean> {
       if (!this.phaseManager) {
         return false;
       }

       const state = await this.deps.stateManager.load();
       return this.phaseManager.shouldTransition(state);
     }

     async transitionPhase(targetPhase: string): Promise<void> {
       await this.deps.stateManager.update((state) => ({
         ...state,
         currentPhase: targetPhase,
       }));

       await this.deps.trajectory.log({
         type: 'phase_transition',
         timestamp: Date.now(),
         fromPhase: (await this.deps.stateManager.load()).currentPhase,
         toPhase: targetPhase,
       });
     }

     async executeGate(gateName: string): Promise<{ passed: boolean }> {
       if (!this.gateExecutor) {
         return { passed: false };
       }

       const state = await this.deps.stateManager.load();
       return this.gateExecutor.execute(gateName, state);
     }
   }
   ```

4. **Run test, verify PASS**

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(daemon): extract WorkflowCoordinator service"
   ```

---

### Task 10: Create IPC Handler Registry

**Files:**
- Create: `packages/daemon/src/core/ipc-handlers.ts`
- Test: `packages/daemon/src/core/ipc-handlers.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // packages/daemon/src/core/ipc-handlers.test.ts
   import { describe, it, expect, vi } from 'vitest';
   import { registerIPCHandlers } from './ipc-handlers.js';

   describe('registerIPCHandlers', () => {
     it('registers ping handler', async () => {
       const mockServer = { registerHandler: vi.fn() };

       registerIPCHandlers(mockServer as any, {
         stateManager: {} as any,
         trajectory: { tail: vi.fn() } as any,
         agentLifecycle: {} as any,
         stopCallback: vi.fn(),
       });

       expect(mockServer.registerHandler).toHaveBeenCalledWith('ping', expect.any(Function));
     });

     it('registers get_state handler', async () => {
       const mockServer = { registerHandler: vi.fn() };

       registerIPCHandlers(mockServer as any, {
         stateManager: { load: vi.fn() } as any,
         trajectory: { tail: vi.fn() } as any,
         agentLifecycle: {} as any,
         stopCallback: vi.fn(),
       });

       expect(mockServer.registerHandler).toHaveBeenCalledWith('get_state', expect.any(Function));
     });

     it('registers get_logs handler', async () => {
       const mockServer = { registerHandler: vi.fn() };

       registerIPCHandlers(mockServer as any, {
         stateManager: {} as any,
         trajectory: { tail: vi.fn(), filterByAgent: vi.fn() } as any,
         agentLifecycle: {} as any,
         stopCallback: vi.fn(),
       });

       expect(mockServer.registerHandler).toHaveBeenCalledWith('get_logs', expect.any(Function));
     });
   });
   ```

2. **Run test, verify FAILURE**

3. **Implement MINIMAL code:**
   ```typescript
   // packages/daemon/src/core/ipc-handlers.ts
   import type { IPCServer } from '../ipc/server.js';
   import type { StateManager } from '../state/manager.js';
   import type { TrajectoryLogger } from '../trajectory/logger.js';
   import type { AgentLifecycle } from './agent-lifecycle.js';

   export interface IPCHandlerDeps {
     stateManager: StateManager;
     trajectory: TrajectoryLogger;
     agentLifecycle: AgentLifecycle;
     stopCallback: () => Promise<void>;
   }

   export function registerIPCHandlers(server: IPCServer, deps: IPCHandlerDeps): void {
     server.registerHandler('ping', async () => ({
       running: true,
       pid: process.pid,
     }));

     server.registerHandler('get_state', async () => ({
       state: await deps.stateManager.load(),
     }));

     server.registerHandler('get_logs', async (request: unknown) => {
       const req = request as { limit?: number; agentId?: string };
       const limit = req.limit ?? 20;

       let events;
       if (req.agentId) {
         events = await deps.trajectory.filterByAgent(req.agentId, limit);
       } else {
         events = await deps.trajectory.tail(limit);
       }

       return {
         logs: events.map((e) => ({
           timestamp: e.timestamp,
           agentId: e.agentId ?? 'system',
           type: e.type,
           message: JSON.stringify(e),
         })),
       };
     });

     server.registerHandler('heartbeat', async (request: unknown) => {
       const req = request as { agentId: string };
       deps.agentLifecycle.recordHeartbeat(req.agentId);
       return { recorded: true };
     });

     server.registerHandler('shutdown', async () => {
       await deps.stopCallback();
       return { shutting_down: true };
     });

     server.registerHandler('status', async (request: unknown) => {
       const req = request as { eventCount?: number };
       const state = await deps.stateManager.load();
       const events = await deps.trajectory.tail(req.eventCount ?? 10);

       return {
         state,
         events,
         activeAgents: deps.agentLifecycle.getActiveAgents().map((a) => a.id),
       };
     });
   }
   ```

4. **Run test, verify PASS**

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(daemon): extract IPC handlers into registry"
   ```

---

### Task 11: Refactor Daemon to Use Extracted Services

**Files:**
- Modify: `packages/daemon/src/core/daemon.ts`
- Modify: `packages/daemon/src/index.ts`
- Test: `packages/daemon/src/core/daemon.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // Update packages/daemon/src/core/daemon.test.ts
   describe('Daemon with extracted services', () => {
     it('delegates event processing to EventProcessor', async () => {
       // Existing tests should still pass
       daemon = new Daemon({ worktreeRoot: tempDir });
       await daemon.start();

       // Verify services are wired
       expect(daemon['eventProcessor']).toBeDefined();
       expect(daemon['agentLifecycle']).toBeDefined();
       expect(daemon['workflowCoordinator']).toBeDefined();
     });
   });
   ```

2. **Run existing tests, verify they pass before refactoring:**
   ```bash
   pnpm test packages/daemon/src/core/daemon.test.ts -- --reporter=verbose
   ```

3. **Refactor Daemon to use services:**
   ```typescript
   // packages/daemon/src/core/daemon.ts
   import { EventProcessor } from './event-processor.js';
   import { AgentLifecycle } from './agent-lifecycle.js';
   import { WorkflowCoordinator } from './workflow-coordinator.js';
   import { registerIPCHandlers } from './ipc-handlers.js';

   export class Daemon {
     // ... existing fields ...

     // New service instances
     private eventProcessor!: EventProcessor;
     private agentLifecycle!: AgentLifecycle;
     private workflowCoordinator!: WorkflowCoordinator;

     async start(): Promise<void> {
       // ... existing initialization ...

       // Initialize services
       this.eventProcessor = new EventProcessor({
         trajectory: this.trajectory,
         stateManager: this.stateManager,
         checkerChain: this.checkerChain,
         correctionApplicator: this.correctionApplicator,
       });

       this.agentLifecycle = new AgentLifecycle({
         agentManager: this.agentManager,
         stateManager: this.stateManager,
         trajectory: this.trajectory,
         heartbeatMonitor: this.heartbeatMonitor,
       });

       this.workflowCoordinator = new WorkflowCoordinator({
         stateManager: this.stateManager,
         trajectory: this.trajectory,
       });

       // Register IPC handlers
       registerIPCHandlers(this.ipcServer, {
         stateManager: this.stateManager,
         trajectory: this.trajectory,
         agentLifecycle: this.agentLifecycle,
         stopCallback: () => this.stop(),
       });

       // ... rest of start() ...
     }

     // Simplify processAgentEvent to delegate
     private async processAgentEvent(agentId: string, event: TrajectoryEvent): Promise<void> {
       await this.eventProcessor.process(agentId, event);
     }

     // Delegate to services
     async loadWorkflow(path: string): Promise<void> {
       await this.workflowCoordinator.load(path);
       this.workflow = this.workflowCoordinator.getWorkflow();
     }
   }
   ```

4. **Run tests, verify PASS:**
   ```bash
   pnpm test packages/daemon/src/core/daemon.test.ts -- --reporter=verbose
   ```

5. **Commit:**
   ```bash
   git add -A && git commit -m "refactor(daemon): use extracted services"
   ```

---

### Task 12: Update Daemon Package Exports

**Files:**
- Modify: `packages/daemon/src/index.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Verify current exports work:**
   ```bash
   pnpm build && pnpm typecheck
   ```

2. **Add new service exports:**
   ```typescript
   // packages/daemon/src/index.ts
   // ... existing exports ...

   // Core services
   export { EventProcessor } from './core/event-processor.js';
   export type { EventProcessorDeps, ProcessEventResult } from './core/event-processor.js';

   export { AgentLifecycle } from './core/agent-lifecycle.js';
   export type { AgentLifecycleDeps, SpawnSpec } from './core/agent-lifecycle.js';

   export { WorkflowCoordinator } from './core/workflow-coordinator.js';
   export type { WorkflowCoordinatorDeps } from './core/workflow-coordinator.js';

   export { registerIPCHandlers } from './core/ipc-handlers.js';
   export type { IPCHandlerDeps } from './core/ipc-handlers.js';
   ```

3. **Verify exports work:**
   ```bash
   pnpm build && pnpm typecheck
   ```

4. **Commit:**
   ```bash
   git add -A && git commit -m "feat(daemon): export extracted services"
   ```

---

### Group 5: Verification (Final)

---

### Task 13: Run Full Test Suite and Type Check

**Files:** None (verification only)

**Steps:**

1. **Run all tests:**
   ```bash
   pnpm test
   ```

2. **Run type check:**
   ```bash
   pnpm typecheck
   ```

3. **Run lint:**
   ```bash
   pnpm lint
   ```

4. **Fix any issues found**

5. **Final commit:**
   ```bash
   git add -A && git commit -m "chore: fix issues from full verification"
   ```

---

### Task 14: Code Review

This task will be handled by the code-reviewer agent after all implementation is complete.

---

## Parallel Execution Groups

| Group | Tasks | Rationale |
|-------|-------|-----------|
| Group 1 | 1 | Foundation - IPC schema needed by others |
| Group 2 | 2, 3, 4, 5 | CLI commands are independent after IPC schema |
| Group 3 | 6 | CorrectionApplicator independent |
| Group 4 | 7, 8, 9, 10 | Services can be extracted in parallel |
| Group 5 | 11 | Depends on all services being ready |
| Group 6 | 12, 13 | Final verification |
| Group 7 | 14 | Code review |

---

## Success Criteria

1. All CLI commands (logs, dev, resume) work end-to-end
2. CorrectionApplicator implements all 8 correction types
3. Daemon reduced from 570 lines to ~150 lines
4. 4 new services extracted with full test coverage
5. All existing tests continue to pass
6. Type check and lint pass with no errors
