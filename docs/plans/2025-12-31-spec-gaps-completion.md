# Implementation Plan: SPEC-3 Gaps Completion

**Date**: 2025-12-31
**Goal**: Implement remaining features from SPEC-3-VALIDATION.md that are not yet in the codebase

---

## Gap Analysis Summary

After thorough exploration of the hyh-ts codebase against SPEC-3-VALIDATION.md, the following features are **truly missing**:

| Feature | SPEC Section | Priority | Complexity |
|---------|--------------|----------|------------|
| TaskPacketFactory | 14.3 | High | Medium |
| `hyh subagent-verify` command | 15.5 | High | Low |
| Accurate token counting (tiktoken) | C.3 | Medium | Low |
| Compact correction with PreCompact hook | 16.4 | Medium | Medium |
| Todo progress TUI display | 5.8 | Low | Low |
| Context budget TUI display | 5.8 | Low | Low |

**Already Implemented** (no work needed):
- All DSL builders including `.scaling()` and `.preCompact()` on WorkflowBuilder
- All invariants including `inv.externalTodo()` and `inv.contextLimit()`
- All corrections including `correct.compact()`
- Hooks generator with Stop, SubagentStop, PostToolUse, PreCompact types
- All daemon checkers including TodoChecker and ContextBudgetChecker
- ArtifactManager and ReinjectionManager
- All CLI commands except `hyh subagent-verify`
- Full TUI with all tabs and components

---

## Task Groups

| Group | Tasks | Parallel | Files Touched |
|-------|-------|----------|---------------|
| 1 | 1, 2 | Yes | Separate packages |
| 2 | 3, 4 | Yes | Separate files |
| 3 | 5, 6 | Yes | Different TUI files |
| 4 | 7 | No | Integration test |

---

## Tasks

### Task 1: TaskPacketFactory

**Files:**
- Create: `packages/daemon/src/managers/task-packet.ts`
- Create: `packages/daemon/src/managers/task-packet.test.ts`
- Modify: `packages/daemon/src/managers/index.ts`
- Modify: `packages/daemon/src/agents/manager.ts` (to use TaskPacketFactory)

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST** - Before ANY implementation:
   ```typescript
   // packages/daemon/src/managers/task-packet.test.ts
   import { describe, it, expect } from 'vitest';
   import { TaskPacketFactory } from './task-packet.js';

   describe('TaskPacketFactory', () => {
     it('should generate task packet with objective and constraints', () => {
       const factory = new TaskPacketFactory();
       const packet = factory.create({
         taskId: 't1',
         description: 'Implement login form',
         files: ['src/components/Login.tsx'],
         dependencies: [],
         interfaces: ['UserCredentials', 'AuthResponse'],
       });

       expect(packet.objective).toContain('Implement login form');
       expect(packet.constraints.fileScope).toContain('src/components/Login.tsx');
       expect(packet.context.interfaces).toContain('UserCredentials');
       expect(packet.doNot).toContain('modify files outside scope');
     });

     it('should load dependency artifacts into context', async () => {
       const mockArtifactManager = {
         loadForDependencies: vi.fn().mockResolvedValue({
           't0': { summary: 'Created auth types', exports: ['AuthToken'] }
         }),
       };
       const factory = new TaskPacketFactory({ artifactManager: mockArtifactManager });

       const packet = await factory.createAsync({
         taskId: 't1',
         description: 'Use auth types',
         files: ['src/api/auth.ts'],
         dependencies: ['t0'],
       });

       expect(packet.context.dependencyArtifacts).toHaveProperty('t0');
       expect(packet.context.dependencyArtifacts['t0'].exports).toContain('AuthToken');
     });

     it('should exclude specified context items', () => {
       const factory = new TaskPacketFactory();
       const packet = factory.create({
         taskId: 't1',
         description: 'Quick fix',
         files: ['src/fix.ts'],
         exclude: ['exploration', 'history'],
       });

       expect(packet.doNot).toContain('include exploration context');
       expect(packet.doNot).toContain('include history context');
     });
   });
   ```

2. **Run test, verify FAILURE:**
   ```bash
   cd packages/daemon && pnpm test src/managers/task-packet.test.ts
   ```
   Expected: FAIL (TaskPacketFactory not found)

3. **Implement MINIMAL code:**
   ```typescript
   // packages/daemon/src/managers/task-packet.ts
   import type { ArtifactManager } from './artifact.js';

   export interface TaskPacketInput {
     taskId: string;
     description: string;
     files: string[];
     dependencies?: string[];
     interfaces?: string[];
     exclude?: string[];
   }

   export interface TaskPacket {
     objective: string;
     constraints: {
       fileScope: string[];
       tdd: boolean;
     };
     context: {
       interfaces: string[];
       dependencyArtifacts: Record<string, unknown>;
     };
     doNot: string[];
   }

   interface TaskPacketFactoryOptions {
     artifactManager?: ArtifactManager;
   }

   export class TaskPacketFactory {
     private readonly artifactManager?: ArtifactManager;

     constructor(options?: TaskPacketFactoryOptions) {
       this.artifactManager = options?.artifactManager;
     }

     create(input: TaskPacketInput): TaskPacket {
       const doNot = ['modify files outside scope'];
       if (input.exclude?.includes('exploration')) {
         doNot.push('include exploration context');
       }
       if (input.exclude?.includes('history')) {
         doNot.push('include history context');
       }

       return {
         objective: input.description,
         constraints: {
           fileScope: input.files,
           tdd: true,
         },
         context: {
           interfaces: input.interfaces ?? [],
           dependencyArtifacts: {},
         },
         doNot,
       };
     }

     async createAsync(input: TaskPacketInput): Promise<TaskPacket> {
       const packet = this.create(input);

       if (this.artifactManager && input.dependencies?.length) {
         const artifacts = await this.artifactManager.loadForDependencies(input.dependencies);
         packet.context.dependencyArtifacts = artifacts;
       }

       return packet;
     }
   }
   ```

4. **Run test, verify PASS:**
   ```bash
   cd packages/daemon && pnpm test src/managers/task-packet.test.ts
   ```
   Expected: PASS (all tests green)

5. **Export from index and update AgentManager to use it**

6. **Commit with conventional format:**
   ```bash
   git add -A && git commit -m "feat(daemon): add TaskPacketFactory for structured task handoff"
   ```

---

### Task 2: hyh subagent-verify Command

**Files:**
- Create: `packages/cli/src/commands/subagent-verify.ts`
- Create: `packages/cli/src/commands/subagent-verify.test.ts`
- Modify: `packages/cli/src/index.ts` (register command)

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // packages/cli/src/commands/subagent-verify.test.ts
   import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
   import * as fs from 'node:fs/promises';
   import * as os from 'node:os';
   import * as path from 'node:path';

   describe('subagent-verify command', () => {
     let tmpDir: string;

     beforeEach(async () => {
       tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hyh-subagent-verify-'));
     });

     afterEach(async () => {
       await fs.rm(tmpDir, { recursive: true, force: true });
     });

     it('should fail if todo.md has incomplete items', async () => {
       await fs.writeFile(
         path.join(tmpDir, 'todo.md'),
         '# Todo\n- [ ] Incomplete item\n- [x] Done item'
       );

       const { subagentVerify } = await import('./subagent-verify.js');
       const result = await subagentVerify({ cwd: tmpDir });

       expect(result.passed).toBe(false);
       expect(result.errors).toContain('1 incomplete todo item(s)');
     });

     it('should pass if all todo items complete', async () => {
       await fs.writeFile(
         path.join(tmpDir, 'todo.md'),
         '# Todo\n- [x] Done item 1\n- [x] Done item 2'
       );

       const { subagentVerify } = await import('./subagent-verify.js');
       const result = await subagentVerify({ cwd: tmpDir });

       expect(result.passed).toBe(true);
     });

     it('should run tests if --tests flag provided', async () => {
       await fs.writeFile(path.join(tmpDir, 'todo.md'), '# Todo\n- [x] Done');
       await fs.writeFile(
         path.join(tmpDir, 'package.json'),
         JSON.stringify({ scripts: { test: 'echo "tests pass"' } })
       );

       const { subagentVerify } = await import('./subagent-verify.js');
       const result = await subagentVerify({ cwd: tmpDir, tests: true });

       expect(result.passed).toBe(true);
       expect(result.checks).toContain('tests');
     });
   });
   ```

2. **Run test, verify FAILURE:**
   ```bash
   cd packages/cli && pnpm test src/commands/subagent-verify.test.ts
   ```
   Expected: FAIL (module not found)

3. **Implement MINIMAL code:**
   ```typescript
   // packages/cli/src/commands/subagent-verify.ts
   import * as fs from 'node:fs/promises';
   import * as path from 'node:path';
   import { execa } from 'execa';
   import type { Command } from 'commander';

   interface SubagentVerifyOptions {
     cwd?: string;
     tests?: boolean;
     typecheck?: boolean;
     lint?: boolean;
   }

   interface VerifyResult {
     passed: boolean;
     checks: string[];
     errors: string[];
   }

   export async function subagentVerify(options: SubagentVerifyOptions = {}): Promise<VerifyResult> {
     const cwd = options.cwd ?? process.cwd();
     const errors: string[] = [];
     const checks: string[] = [];

     // Check todo.md
     const todoPath = path.join(cwd, 'todo.md');
     try {
       const content = await fs.readFile(todoPath, 'utf-8');
       const incomplete = (content.match(/- \[ \]/g) || []).length;
       if (incomplete > 0) {
         errors.push(`${incomplete} incomplete todo item(s)`);
       }
       checks.push('todo');
     } catch {
       // No todo.md is okay
     }

     // Run tests if requested
     if (options.tests) {
       try {
         await execa('npm', ['test'], { cwd });
         checks.push('tests');
       } catch {
         errors.push('Tests failed');
       }
     }

     // Run typecheck if requested
     if (options.typecheck) {
       try {
         await execa('npm', ['run', 'typecheck'], { cwd });
         checks.push('typecheck');
       } catch {
         errors.push('Typecheck failed');
       }
     }

     // Run lint if requested
     if (options.lint) {
       try {
         await execa('npm', ['run', 'lint'], { cwd });
         checks.push('lint');
       } catch {
         errors.push('Lint failed');
       }
     }

     return {
       passed: errors.length === 0,
       checks,
       errors,
     };
   }

   export function registerSubagentVerifyCommand(program: Command): void {
     program
       .command('subagent-verify')
       .description('Verify subagent completion (used by SubagentStop hook)')
       .option('--tests', 'Run tests')
       .option('--typecheck', 'Run typecheck')
       .option('--lint', 'Run lint')
       .action(async (opts) => {
         const result = await subagentVerify(opts);
         if (!result.passed) {
           console.error('Verification failed:');
           for (const error of result.errors) {
             console.error(`  - ${error}`);
           }
           process.exit(1);
         }
         console.log('Verification passed');
         console.log(`Checks: ${result.checks.join(', ')}`);
       });
   }
   ```

4. **Run test, verify PASS:**
   ```bash
   cd packages/cli && pnpm test src/commands/subagent-verify.test.ts
   ```

5. **Register in index.ts:**
   ```typescript
   import { registerSubagentVerifyCommand } from './commands/subagent-verify.js';
   // ...
   registerSubagentVerifyCommand(program);
   ```

6. **Commit:**
   ```bash
   git add -A && git commit -m "feat(cli): add hyh subagent-verify command"
   ```

---

### Task 3: Accurate Token Counting with tiktoken

**Files:**
- Modify: `packages/daemon/src/checkers/context-budget.ts`
- Modify: `packages/daemon/src/checkers/context-budget.test.ts`
- Modify: `packages/daemon/package.json` (add tiktoken dependency)

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // Add to packages/daemon/src/checkers/context-budget.test.ts
   describe('estimateTokens with tiktoken', () => {
     it('should estimate tokens more accurately than char/4', () => {
       const text = 'Hello, world!'; // ~3-4 tokens
       const tokens = estimateTokens(text);

       // tiktoken should give ~3-4, not 3 (13/4 = 3.25)
       expect(tokens).toBeGreaterThanOrEqual(2);
       expect(tokens).toBeLessThanOrEqual(5);
     });

     it('should handle code snippets', () => {
       const code = `function hello() { console.log("world"); }`;
       const tokens = estimateTokens(code);

       // Code typically has more tokens per char than prose
       expect(tokens).toBeGreaterThan(5);
     });
   });
   ```

2. **Run test, verify current behavior:**
   ```bash
   cd packages/daemon && pnpm test src/checkers/context-budget.test.ts
   ```

3. **Install tiktoken:**
   ```bash
   cd packages/daemon && pnpm add tiktoken
   ```

4. **Update implementation:**
   ```typescript
   // packages/daemon/src/checkers/context-budget.ts
   import { get_encoding } from 'tiktoken';

   let encoder: ReturnType<typeof get_encoding> | null = null;

   function getEncoder() {
     if (!encoder) {
       encoder = get_encoding('cl100k_base');
     }
     return encoder;
   }

   export function estimateTokens(text: string): number {
     try {
       return getEncoder().encode(text).length;
     } catch {
       // Fallback to char/4 if tiktoken fails
       return Math.ceil(text.length / 4);
     }
   }
   ```

5. **Run test, verify PASS:**
   ```bash
   cd packages/daemon && pnpm test src/checkers/context-budget.test.ts
   ```

6. **Commit:**
   ```bash
   git add -A && git commit -m "feat(daemon): use tiktoken for accurate token counting"
   ```

---

### Task 4: Compact Correction with PreCompact Hook

**Files:**
- Modify: `packages/daemon/src/corrections/applicator.ts`
- Create: `packages/daemon/src/corrections/compact-handler.ts`
- Create: `packages/daemon/src/corrections/compact-handler.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // packages/daemon/src/corrections/compact-handler.test.ts
   import { describe, it, expect, vi } from 'vitest';
   import { CompactHandler } from './compact-handler.js';

   describe('CompactHandler', () => {
     it('should preserve specified message types', async () => {
       const messages = [
         { role: 'user', content: 'explore the codebase' },
         { role: 'assistant', content: 'I found these files...' },
         { role: 'user', content: 'now implement feature X' },
         { role: 'assistant', content: 'Here is the implementation decision...' },
       ];

       const handler = new CompactHandler({
         preserve: ['decisions', 'interfaces'],
         summarize: ['exploration'],
         discard: ['verbose-output'],
       });

       const result = await handler.compact(messages);

       expect(result.length).toBeLessThan(messages.length);
       expect(result.some(m => m.content.includes('decision'))).toBe(true);
     });

     it('should call preCompact hook if provided', async () => {
       const preCompactHook = vi.fn().mockResolvedValue({
         preserved: ['key decision'],
         discarded: 2,
       });

       const handler = new CompactHandler({
         preCompact: preCompactHook,
       });

       await handler.compact([{ role: 'user', content: 'test' }]);

       expect(preCompactHook).toHaveBeenCalled();
     });
   });
   ```

2. **Run test, verify FAILURE:**
   ```bash
   cd packages/daemon && pnpm test src/corrections/compact-handler.test.ts
   ```

3. **Implement MINIMAL code:**
   ```typescript
   // packages/daemon/src/corrections/compact-handler.ts
   interface Message {
     role: string;
     content: string;
   }

   interface CompactOptions {
     preserve?: string[];
     summarize?: string[];
     discard?: string[];
     preCompact?: (messages: Message[]) => Promise<{ preserved: string[]; discarded: number }>;
   }

   export class CompactHandler {
     private readonly options: CompactOptions;

     constructor(options: CompactOptions = {}) {
       this.options = options;
     }

     async compact(messages: Message[]): Promise<Message[]> {
       if (this.options.preCompact) {
         await this.options.preCompact(messages);
       }

       const preserved: Message[] = [];
       const preservePatterns = this.options.preserve ?? ['decisions', 'interfaces', 'blockers'];

       for (const msg of messages) {
         const content = msg.content.toLowerCase();
         const shouldPreserve = preservePatterns.some(p => content.includes(p));

         if (shouldPreserve) {
           preserved.push(msg);
         }
       }

       // Always keep at least the last message
       if (preserved.length === 0 && messages.length > 0) {
         preserved.push(messages[messages.length - 1]);
       }

       return preserved;
     }
   }
   ```

4. **Run test, verify PASS:**
   ```bash
   cd packages/daemon && pnpm test src/corrections/compact-handler.test.ts
   ```

5. **Update CorrectionApplicator to use CompactHandler**

6. **Commit:**
   ```bash
   git add -A && git commit -m "feat(daemon): implement compact correction with PreCompact hook"
   ```

---

### Task 5: Todo Progress TUI Display

**Files:**
- Modify: `packages/tui/src/tabs/Overview.tsx`
- Modify: `packages/tui/src/tabs/Overview.test.tsx`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // Add to packages/tui/src/tabs/Overview.test.tsx
   describe('Todo progress display', () => {
     it('should show todo completion percentage', async () => {
       const state = {
         currentPhase: 'implement',
         todo: {
           total: 10,
           completed: 7,
           incomplete: ['item1', 'item2', 'item3'],
         },
       };

       const { lastFrame } = render(<Overview state={state} />);

       expect(lastFrame()).toContain('Todo: 7/10 (70%)');
     });

     it('should show incomplete items if any', async () => {
       const state = {
         currentPhase: 'implement',
         todo: {
           total: 3,
           completed: 1,
           incomplete: ['Fix tests', 'Update docs'],
         },
       };

       const { lastFrame } = render(<Overview state={state} />);

       expect(lastFrame()).toContain('Fix tests');
       expect(lastFrame()).toContain('Update docs');
     });
   });
   ```

2. **Run test, verify FAILURE**

3. **Implement in Overview.tsx:**
   ```tsx
   // In Overview.tsx, add TodoProgress component
   function TodoProgress({ todo }: { todo?: { total: number; completed: number; incomplete: string[] } }) {
     if (!todo || todo.total === 0) return null;

     const pct = Math.round((todo.completed / todo.total) * 100);

     return (
       <Box flexDirection="column" marginTop={1}>
         <Text bold>Todo: {todo.completed}/{todo.total} ({pct}%)</Text>
         {todo.incomplete.length > 0 && (
           <Box flexDirection="column" marginLeft={2}>
             {todo.incomplete.slice(0, 5).map((item, i) => (
               <Text key={i} color="yellow">- {item}</Text>
             ))}
             {todo.incomplete.length > 5 && (
               <Text dimColor>... and {todo.incomplete.length - 5} more</Text>
             )}
           </Box>
         )}
       </Box>
     );
   }
   ```

4. **Run test, verify PASS**

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(tui): add todo progress display to Overview tab"
   ```

---

### Task 6: Context Budget TUI Display

**Files:**
- Modify: `packages/tui/src/tabs/Agents.tsx`
- Modify: `packages/tui/src/tabs/Agents.test.tsx`
- Modify: `packages/tui/src/components/ProgressBar.tsx` (reuse for context)

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // Add to packages/tui/src/tabs/Agents.test.tsx
   describe('Context budget display', () => {
     it('should show context usage for each agent', async () => {
       const agents = [{
         agentId: 'worker-1',
         status: 'running',
         contextUsage: { current: 80000, max: 100000 },
       }];

       const { lastFrame } = render(<Agents agents={agents} />);

       expect(lastFrame()).toContain('Context: 80%');
     });

     it('should highlight when context is high', async () => {
       const agents = [{
         agentId: 'worker-1',
         status: 'running',
         contextUsage: { current: 90000, max: 100000 },
       }];

       const { lastFrame } = render(<Agents agents={agents} />);

       // Should show warning color for >80%
       expect(lastFrame()).toContain('90%');
     });
   });
   ```

2. **Run test, verify FAILURE**

3. **Implement in Agents.tsx:**
   ```tsx
   // In Agents.tsx, add context usage display
   function AgentContextUsage({ usage }: { usage?: { current: number; max: number } }) {
     if (!usage) return null;

     const pct = Math.round((usage.current / usage.max) * 100);
     const color = pct > 80 ? 'red' : pct > 60 ? 'yellow' : 'green';

     return (
       <Text color={color}>Context: {pct}%</Text>
     );
   }
   ```

4. **Run test, verify PASS**

5. **Commit:**
   ```bash
   git add -A && git commit -m "feat(tui): add context budget display to Agents tab"
   ```

---

### Task 7: Integration Test

**Files:**
- Modify: `packages/daemon/src/integration/full-workflow.test.ts`

**TDD Instructions (MANDATORY - follow exactly):**

1. **Write test FIRST:**
   ```typescript
   // Add to full-workflow.test.ts
   it('should create task packets for spawned agents', async () => {
     // Setup workflow with TaskPacketFactory
     const workflow = {
       name: 'packet-test',
       // ...
     };

     await daemon.start();
     await daemon.loadWorkflow(workflowPath);

     // Add a task with dependencies
     await daemon.stateManager.update(s => {
       s.tasks = {
         't0': { id: 't0', status: 'completed', files: ['src/types.ts'] },
         't1': { id: 't1', status: 'pending', dependencies: ['t0'], files: ['src/api.ts'] },
       };
     });

     // Check spawn creates proper task packet
     const spawns = await daemon.checkSpawnTriggers();
     expect(spawns[0].taskPacket).toBeDefined();
     expect(spawns[0].taskPacket.context.dependencyArtifacts).toHaveProperty('t0');
   });

   it('should run subagent-verify on stop', async () => {
     // Setup with SubagentStop hook
     // Verify that hyh subagent-verify is called
   });
   ```

2. **Run test, verify FAILURE**

3. **Wire up TaskPacketFactory in daemon**

4. **Run test, verify PASS**

5. **Commit:**
   ```bash
   git add -A && git commit -m "test(daemon): add integration tests for task packets and subagent-verify"
   ```

---

## Execution Summary

| Task | Depends On | Files | Estimated Complexity |
|------|------------|-------|---------------------|
| 1 | None | 4 | Medium |
| 2 | None | 3 | Low |
| 3 | None | 3 | Low |
| 4 | None | 4 | Medium |
| 5 | None | 2 | Low |
| 6 | None | 3 | Low |
| 7 | 1, 2 | 1 | Medium |

**Total new files**: 8
**Total modified files**: 9
