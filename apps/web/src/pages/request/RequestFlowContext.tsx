import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { BillingDay, RequestItemInput } from '../../api/types';

const STORAGE_KEY = 'moveo.billing-day-request.v1';

interface FlowState {
  selectedIds: string[];
  days: Record<string, BillingDay>;
  /** One UUID per attempt. Sent as Idempotency-Key so a retry never creates a second request. */
  idempotencyKey: string;
}

interface FlowApi extends FlowState {
  toggle(id: string): void;
  setSelected(ids: string[]): void;
  setDay(id: string, day: BillingDay): void;
  items: RequestItemInput[];
  reset(): void;
}

const Ctx = createContext<FlowApi | null>(null);

const newKey = () =>
  typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

const fresh = (): FlowState => ({ selectedIds: [], days: {}, idempotencyKey: newKey() });

function load(): FlowState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FlowState>;
      if (Array.isArray(parsed.selectedIds) && parsed.days && typeof parsed.idempotencyKey === 'string') {
        return parsed as FlowState;
      }
    }
  } catch {
    /* ignore corrupt storage */
  }
  return fresh();
}

/**
 * Wizard state. Persisted in sessionStorage so a page refresh keeps the customer's progress (and the
 * Idempotency-Key), but cleared when the customer leaves the flow: the provider is mounted only under
 * the request route, so leaving it (exit link, nav, browser back) unmounts the provider and the
 * cleanup below drops the saved state. Next entry starts fresh with a new key.
 */
export function RequestFlowProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FlowState>(load);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable (private mode) – flow still works in memory */
    }
  }, [state]);

  useEffect(
    () => () => {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const toggle = useCallback((id: string) => {
    setState((s) => {
      const selected = s.selectedIds.includes(id) ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id];
      const days = { ...s.days };
      if (!selected.includes(id)) delete days[id];
      return { ...s, selectedIds: selected, days };
    });
  }, []);

  const setSelected = useCallback((ids: string[]) => {
    setState((s) => ({
      ...s,
      selectedIds: ids,
      days: Object.fromEntries(Object.entries(s.days).filter(([id]) => ids.includes(id))) as Record<string, BillingDay>,
    }));
  }, []);

  const setDay = useCallback((id: string, day: BillingDay) => {
    setState((s) => ({ ...s, days: { ...s.days, [id]: day } }));
  }, []);

  const reset = useCallback(() => {
    setState(fresh());
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo<FlowApi>(
    () => ({
      ...state,
      toggle,
      setSelected,
      setDay,
      reset,
      items: state.selectedIds
        .filter((id) => state.days[id] !== undefined)
        .map((id) => ({ mortgageId: id, newBillingDay: state.days[id]! })),
    }),
    [state, toggle, setSelected, setDay, reset],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRequestFlow(): FlowApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useRequestFlow must be used inside RequestFlowProvider');
  return ctx;
}
