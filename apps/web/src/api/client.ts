import type { ApiErrorBody, BillingDayRequest, Lobby, RequestItemInput, RequestPreview } from './types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '/api/v1';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'לא ניתן להתחבר לשרת');
  }

  if (!res.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error body */
    }
    const message = Array.isArray(body.message) ? body.message.join(', ') : (body.message ?? res.statusText);
    throw new ApiError(res.status, body.code ?? 'HTTP_ERROR', message, body.details);
  }
  return (await res.json()) as T;
}

export const api = {
  getLobby: () => request<Lobby>('/lobby'),

  previewRequest: (items: RequestItemInput[]) =>
    request<RequestPreview>('/billing-day-requests/preview', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  createRequest: (items: RequestItemInput[], idempotencyKey: string) =>
    request<BillingDayRequest>('/billing-day-requests', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ items }),
    }),

  getRequest: (id: string) => request<BillingDayRequest>(`/billing-day-requests/${id}`),
};
