// packages/tui/src/hooks/useDaemon.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useDaemon hook', () => {
  it('exports useDaemon function', async () => {
    const { useDaemon } = await import('./useDaemon.js');
    expect(useDaemon).toBeDefined();
  });
});
