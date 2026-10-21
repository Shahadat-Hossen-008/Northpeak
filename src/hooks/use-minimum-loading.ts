import { useEffect, useState } from "react";

const MINIMUM_LOADING_DURATION_MS = 1_400;

/** Keep the page loader visible after entry while data requests run independently. */
export function useMinimumLoading(isLoading: boolean, routeKey = "workspace-page"): boolean {
  const [elapsedRouteKey, setElapsedRouteKey] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(
      () => setElapsedRouteKey(routeKey),
      MINIMUM_LOADING_DURATION_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [routeKey]);

  return isLoading || elapsedRouteKey !== routeKey;
}
