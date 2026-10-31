import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { FLOW_BASE } from '../../routes';
import { STEPS, useCurrentStep } from './RequestFlowLayout';

const at = (path: string) =>
  renderHook(() => useCurrentStep(), {
    wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>,
  }).result.current;

describe('useCurrentStep', () => {
  it('maps each step route to its index', () => {
    expect(at(`${FLOW_BASE}/select`)).toBe(0);
    expect(at(`${FLOW_BASE}/day`)).toBe(1);
    expect(at(`${FLOW_BASE}/summary`)).toBe(2);
  });

  it('treats the done screen as "after the last step"', () => {
    expect(at(`${FLOW_BASE}/done/abc-123`)).toBe(STEPS.length);
  });

  it('falls back to the first step for an unknown path', () => {
    expect(at(`${FLOW_BASE}/whatever`)).toBe(0);
  });
});
