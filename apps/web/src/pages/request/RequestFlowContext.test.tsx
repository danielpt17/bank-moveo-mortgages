import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { RequestFlowProvider, useRequestFlow } from './RequestFlowContext';

const STORAGE_KEY = 'moveo.billing-day-request.v1';
const wrapper = ({ children }: { children: ReactNode }) => <RequestFlowProvider>{children}</RequestFlowProvider>;
const render = () => renderHook(() => useRequestFlow(), { wrapper });

afterEach(() => sessionStorage.clear());

describe('RequestFlowProvider', () => {
  it('toggles a mortgage and drops its day when it is deselected', () => {
    const { result } = render();
    act(() => result.current.toggle('m1'));
    act(() => result.current.setDay('m1', 10));
    expect(result.current.selectedIds).toEqual(['m1']);
    expect(result.current.items).toEqual([{ mortgageId: 'm1', newBillingDay: 10 }]);

    act(() => result.current.toggle('m1'));
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.days).toEqual({});
  });

  it('setSelected keeps only the days of mortgages that are still selected', () => {
    const { result } = render();
    act(() => result.current.setSelected(['m1', 'm2']));
    act(() => result.current.setDay('m1', 1));
    act(() => result.current.setDay('m2', 15));
    act(() => result.current.setSelected(['m2']));
    expect(result.current.days).toEqual({ m2: 15 });
    expect(result.current.items).toEqual([{ mortgageId: 'm2', newBillingDay: 15 }]);
  });

  it('only mortgages with a chosen day become request items', () => {
    const { result } = render();
    act(() => result.current.setSelected(['m1', 'm2']));
    act(() => result.current.setDay('m1', 1));
    expect(result.current.items).toEqual([{ mortgageId: 'm1', newBillingDay: 1 }]);
  });

  it('survives a refresh: state and the idempotency key are restored from sessionStorage', () => {
    const first = render();
    act(() => first.result.current.toggle('m1'));
    const key = first.result.current.idempotencyKey;
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    // a refresh re-mounts the provider; sessionStorage is still there
    const saved = sessionStorage.getItem(STORAGE_KEY)!;
    first.unmount();
    sessionStorage.setItem(STORAGE_KEY, saved);

    const second = render();
    expect(second.result.current.selectedIds).toEqual(['m1']);
    expect(second.result.current.idempotencyKey).toBe(key);
  });

  it('leaving the flow (provider unmount) clears the saved state', () => {
    const { result, unmount } = render();
    act(() => result.current.toggle('m1'));
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();
    unmount();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('reset starts a new attempt with a new idempotency key', () => {
    const { result } = render();
    const key = result.current.idempotencyKey;
    act(() => result.current.toggle('m1'));
    act(() => result.current.reset());
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.idempotencyKey).not.toBe(key);
  });
});
