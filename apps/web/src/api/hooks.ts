import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { RequestItemInput } from './types';

export const lobbyQueryKey = ['lobby'] as const;

export function useLobby() {
  return useQuery({ queryKey: lobbyQueryKey, queryFn: api.getLobby, staleTime: 30_000 });
}

export function useRequestPreview(items: RequestItemInput[], enabled: boolean) {
  return useQuery({
    queryKey: ['billing-day-request-preview', items],
    queryFn: () => api.previewRequest(items),
    enabled: enabled && items.length > 0,
    staleTime: 60_000,
    retry: false,
  });
}

export function useCreateRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ items, idempotencyKey }: { items: RequestItemInput[]; idempotencyKey: string }) =>
      api.createRequest(items, idempotencyKey),
    onSuccess: (request) => {
      queryClient.setQueryData(['billing-day-request', request.id], request);
      // The API invalidated its Redis copy; drop ours so the lobby shows the pending badge.
      void queryClient.invalidateQueries({ queryKey: lobbyQueryKey });
    },
    retry: false,
  });
}

export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: ['billing-day-request', id],
    queryFn: () => api.getRequest(id!),
    enabled: Boolean(id),
  });
}
