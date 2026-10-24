import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { STALE } from "./hooks/queries/stale-times";

export const getRouter = () => {
  const queryClient = new QueryClient({
    // One-minute freshness, ten-minute retention, and one retry reuse data without hiding edits.
    defaultOptions: {
      queries: {
        staleTime: STALE.normal,
        gcTime: 10 * 60_000,
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Keep preload data immediately stale because TanStack Query owns the cache.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
