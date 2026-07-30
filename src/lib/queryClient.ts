import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: 15000,
      refetchIntervalInBackground: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

/** Drop cached camp data when the active company changes. */
export function invalidateCampScopedQueries() {
  void queryClient.invalidateQueries();
}
