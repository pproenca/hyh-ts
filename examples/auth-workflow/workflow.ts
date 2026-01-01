// examples/auth-workflow/workflow.ts
// A multi-phase workflow demonstrating hyh orchestration
import { workflow, agent, queue, inv, compile } from '@hyh/dsl';

// Define agents
const orch = agent('orchestrator')
  .model('opus')
  .role('orchestrator');

const dev = agent('developer')
  .model('sonnet')
  .role('worker')
  .invariants(
    inv.tdd({
      test: '**/*.test.ts',
      impl: '**/!(*.test).ts',
      order: ['test', 'impl'],
    })
  );

// Define task queue
const tasks = queue('implementation-tasks');

// Build workflow
const w = workflow('auth-feature')
  .orchestrator(orch)
  .phase('plan')
    .agent(orch)
    .expects('Read', 'Grep', 'Glob')
    .forbids('Write', 'Edit')
    .populates(tasks)
  .phase('implement')
    .agent(dev)
    .queue(tasks)
    .parallel(2)
  .phase('verify')
    .agent(orch)
    .expects('Bash')
  .build();

compile(w);
