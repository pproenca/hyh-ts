# CLI Demo & Onboarding Design

**Date:** 2025-01-01
**Status:** Draft

## Overview

Create a "Bun-like" CLI experience for hyh with an interactive demo/onboarding command, using the same libraries as Claude Code (Ink + React).

## Goals

1. **Demo command** - Show new users what hyh does via pre-built simulation
2. **Interactive builder** - Let users create their first workflow via prompts
3. **CLI polish** - Rich colors, spinners, smart help output
4. **Bun migration** (Phase 2) - Fast startup, single executable distribution

## Library Stack

| Library | Purpose | Status |
|---------|---------|--------|
| `ink` ^5.0.0 | React for terminal | Already have |
| `react` ^18 | Component model | Already have |
| `@inkjs/ui` ^2.0.0 | Spinners, progress, select, confirm | Add |
| `chalk` ^5.3.0 | Rich colors (256 + truecolor) | Add |
| `commander` ^12 | CLI parsing | Already have |

## Demo Command Architecture

### Two Modes

```bash
hyh demo           # Pre-built simulation (immediate wow factor)
hyh demo --create  # Interactive workflow builder (hands-on learning)
```

### Pre-built Demo Flow

1. Display animated banner/logo
2. Run canned "feature-builder" workflow simulation showing:
   - Orchestrator agent spawning
   - Phase transitions (design → implement → verify)
   - Developer agents claiming tasks from queue
   - TDD checker validations
   - Real-time progress bars + status updates
3. End with summary + prompt to try `hyh demo --create`

### Interactive Creation Flow

1. Prompt for workflow name
2. Multi-select agent types (orchestrator, developer, reviewer)
3. Select phases and their allowed tools
4. Configure parallel execution limit
5. Generate workflow file and offer to run simulation

## Component Structure (Claude Code-aligned)

Following Claude Code's "ultra-lightweight shell" philosophy - minimal scaffolding, composition over configuration.

```
packages/cli/src/
├── commands/
│   └── demo.ts              # Command registration + orchestration
├── components/
│   ├── Banner.tsx           # Logo + tagline
│   ├── Simulation.tsx       # All simulation display
│   └── Builder.tsx          # Interactive workflow builder
└── hooks/
    └── useSimulation.ts     # State progression hook
```

### Design Principles

1. **Functional components only** - no classes
2. **Composition over configuration** - small, composable pieces
3. **Inline sub-components when simple** - don't over-extract
4. **Hooks for state logic, components for display**
5. **No shared/ folder until code is used by 2+ features**

### File Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `Banner.tsx`, `Simulation.tsx` |
| Hooks | camelCase + use prefix | `useSimulation.ts` |
| Commands | lowercase | `demo.ts` |

## Component Details

### Banner.tsx

Animated ASCII art with chalk colors, brief tagline about hyh.

### Simulation.tsx

Displays the pre-built workflow simulation:
- Phase cards showing current phase and allowed tools
- Agent status with `<Spinner>` during work
- Task list with real-time status updates
- `<ProgressBar>` for overall completion
- Event log showing checker validations

### Builder.tsx

Step-by-step workflow creation:
- `<TextInput>` for workflow name
- `<Select>` for model choices (opus, sonnet)
- `<MultiSelect>` for allowed tools per phase
- `<Confirm>` to proceed/run simulation

### useSimulation.ts Hook

```typescript
interface Step {
  phase: string;
  agents: Agent[];
  tasks: Task[];
  events: string[];
}

function useSimulation(steps: Step[]) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex(i => Math.min(i + 1, steps.length - 1));
    }, 800);
    return () => clearInterval(timer);
  }, [steps.length]);

  return {
    current: steps[index],
    isComplete: index >= steps.length - 1,
    progress: (index / steps.length) * 100
  };
}
```

## CLI Polish

### Enhanced Help Output

```typescript
program
  .command('demo')
  .description(chalk.dim('Interactive demo and onboarding'))
  .addHelpText('after', `
${chalk.bold('Examples:')}
  ${chalk.cyan('hyh demo')}           Run pre-built workflow simulation
  ${chalk.cyan('hyh demo --create')}  Build your own workflow interactively
`);
```

### Root Help (Bun-style hints)

```
hyh

  Hold Your Horses - Workflow Orchestration

  Usage: hyh <command> [options]

  Commands:
    init       Initialize a new workflow project
    run        Execute a compiled workflow
    demo       Interactive demo and onboarding  ← try this first!
    status     Show current workflow state

  Run 'hyh <command> --help' for command-specific help
```

## Phase 2: Bun Migration

### Runtime Switch

```json
{
  "scripts": {
    "dev": "bun run packages/cli/src/index.ts",
    "build": "bun build packages/cli/src/index.ts --outdir dist --target bun"
  }
}
```

### Single Executable Build

```bash
bun build packages/cli/src/index.ts --compile --outfile hyh
```

Produces ~50MB standalone binary for distribution.

### Package.json

```json
{
  "engines": {
    "bun": ">=1.0.0"
  }
}
```

## File Changes Summary

**New files:**
- `packages/cli/src/commands/demo.ts`
- `packages/cli/src/components/Banner.tsx`
- `packages/cli/src/components/Simulation.tsx`
- `packages/cli/src/components/Builder.tsx`
- `packages/cli/src/hooks/useSimulation.ts`

**Modified files:**
- `packages/cli/src/index.ts` - register demo command
- `packages/cli/package.json` - add @inkjs/ui, chalk

## Dependencies to Add

```bash
pnpm --filter @hyh/cli add @inkjs/ui chalk
```

## Success Criteria

1. `hyh demo` runs a compelling 30-60 second simulation
2. `hyh demo --create` produces a valid workflow.json
3. CLI startup feels instant (< 100ms perceived)
4. Help output is colored and includes examples
5. Works on macOS, Linux, Windows (via Bun)
