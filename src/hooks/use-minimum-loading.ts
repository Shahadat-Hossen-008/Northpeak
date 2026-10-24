import { useEffect, useRef, useState } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

const MINIMUM_LOADING_DURATION_MS = 1_400;

/** Keep the page loader visible after entry while data requests run independently. */
export function useMinimumLoading(
  isLoading: boolean,
  routeKey = "workspace-page",
  cacheKeys: QueryKey[] = [],
): boolean {
  const queryClient = useQueryClient();
  const routeCache = useRef<{ routeKey: string; hasCachedData: boolean } | null>(null);
  if (routeCache.current?.routeKey !== routeKey) {
    // Cached page data can render immediately while stale queries refresh in the background.
    routeCache.current = {
      routeKey,
      hasCachedData:
        cacheKeys.length > 0 &&
        cacheKeys.every((key) => queryClient.getQueryData(key) !== undefined),
    };
  }
  const hasCachedData = routeCache.current.hasCachedData;
  const [elapsedRouteKey, setElapsedRouteKey] = useState<string | null>(null);

  useEffect(() => {
    if (hasCachedData) {
      setElapsedRouteKey(routeKey);
      return;
    }
    const timeoutId = window.setTimeout(
      () => setElapsedRouteKey(routeKey),
      MINIMUM_LOADING_DURATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [routeKey, hasCachedData]);

  return isLoading || (!hasCachedData && elapsedRouteKey !== routeKey);
}
