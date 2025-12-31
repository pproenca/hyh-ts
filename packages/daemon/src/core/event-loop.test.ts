// packages/daemon/src/core/event-loop.test.ts
import { describe, it, expect, vi } from 'vitest';
import { EventLoop } from './event-loop.js';

describe('EventLoop', () => {
  it('runs tick cycle and can be stopped', async () => {
    const onTick = vi.fn();
    const loop = new EventLoop({ tickInterval: 10, onTick });

    loop.start();
    await new Promise(r => setTimeout(r, 50));
    loop.stop();

    expect(onTick).toHaveBeenCalled();
    expect(loop.isRunning).toBe(false);
  });

  it('does not start if already running', () => {
    const loop = new EventLoop({ tickInterval: 100, onTick: vi.fn() });
    loop.start();
    loop.start(); // Should be no-op
    expect(loop.isRunning).toBe(true);
    loop.stop();
  });

  it('handles async onTick', async () => {
    let counter = 0;
    const onTick = vi.fn(async () => {
      counter++;
      await new Promise(r => setTimeout(r, 5));
    });
    const loop = new EventLoop({ tickInterval: 10, onTick });

    loop.start();
    await new Promise(r => setTimeout(r, 60));
    loop.stop();

    expect(counter).toBeGreaterThan(0);
  });
});
