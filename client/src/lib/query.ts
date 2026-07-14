import { QueryClient } from '@tanstack/react-query';

/**
 * TanStack Query client configuration.
 * Manages server state caching, background refresh, and optimistic updates.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
