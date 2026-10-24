export interface ApiClientEnv {
  VITE_API_BASE_URL?: string | undefined;
  MODE?: string | undefined;
  PROD?: boolean | undefined;
  DEV?: boolean | undefined;
}

function getDefaultEnv(): ApiClientEnv {
  const metaEnv = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  const configuredBaseUrl =
    typeof import.meta !== "undefined" && import.meta.env
      ? import.meta.env["VITE_API_BASE_URL"]
      : undefined;
  return {
    VITE_API_BASE_URL: configuredBaseUrl,
    MODE: metaEnv?.MODE,
    PROD: metaEnv?.PROD,
    DEV: metaEnv?.DEV,
  };
}

export function resolveApiBaseUrl(env?: ApiClientEnv): string {
  const resolvedEnv = env ?? getDefaultEnv();
  const isProd =
    resolvedEnv.PROD === true ||
    resolvedEnv.MODE === "production" ||
    (resolvedEnv.PROD === undefined &&
      resolvedEnv.DEV !== true &&
      resolvedEnv.MODE === undefined &&
      typeof process !== "undefined" &&
      process.env?.["NODE_ENV"] === "production");

  const raw = resolvedEnv.VITE_API_BASE_URL?.trim() ?? "";

  if (!raw) {
    if (isProd) {
      throw new Error(
        "[ConfigError] VITE_API_BASE_URL is required in production. Set it to the HTTPS origin of the deployed backend API.",
      );
    }
    return "/api";
  }

  if (raw === "/api" || /^\/api\/+$/.test(raw)) {
    if (isProd) {
      throw new Error(
        "[ConfigError] VITE_API_BASE_URL must be an absolute backend URL in production, not a relative path.",
      );
    }
    return "/api";
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `[ConfigError] Invalid VITE_API_BASE_URL "${raw}". Expected an absolute HTTP(S) URL.`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `[ConfigError] Invalid VITE_API_BASE_URL protocol "${parsed.protocol}". Expected http: or https:.`,
    );
  }

  if (isProd && parsed.protocol !== "https:") {
    throw new Error("[ConfigError] VITE_API_BASE_URL must use HTTPS in production.");
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      "[ConfigError] VITE_API_BASE_URL must not contain credentials, query parameters, or hash fragments.",
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    isProd &&
    (hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname === "[::1]")
  ) {
    throw new Error(
      `[ConfigError] VITE_API_BASE_URL must not point to localhost in production (received "${raw}").`,
    );
  }

  const cleanPath = parsed.pathname.replace(/\/+$/, "");
  const apiPath =
    cleanPath === "" || cleanPath === "/"
      ? "/api"
      : cleanPath.endsWith("/api")
        ? cleanPath
        : `${cleanPath}/api`;

  return `${parsed.origin}${apiPath}`;
}

export function buildApiUrl(endpoint: string, env?: ApiClientEnv): string {
  const baseUrl = resolveApiBaseUrl(env);
  const rawEndpoint = endpoint.trim();
  const withLeadingSlash = rawEndpoint.startsWith("/") ? rawEndpoint : `/${rawEndpoint}`;

  let normalizedEndpoint = withLeadingSlash;
  while (normalizedEndpoint === "/api" || normalizedEndpoint.startsWith("/api/")) {
    normalizedEndpoint = normalizedEndpoint.slice(4);
  }
  if (normalizedEndpoint.startsWith("/api?")) {
    normalizedEndpoint = normalizedEndpoint.slice(4);
  }

  return `${baseUrl}${normalizedEndpoint}`;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("northpeak_token");
}

let authTokenRevision = 0;
let lastAuthToken: string | null | undefined;
let authFailureHandler: (() => void) | null = null;
let tokenStoredHandler: (() => void) | null = null;
// Gate concurrent 401 responses so they share one logout and navigation.
let handlingAuthFailure = false;

export function registerAuthHandlers(handlers: {
  onUnauthorized: () => void;
  onTokenStored: () => void;
}): () => void {
  authFailureHandler = handlers.onUnauthorized;
  tokenStoredHandler = handlers.onTokenStored;
  return () => {
    authFailureHandler = null;
    tokenStoredHandler = null;
  };
}

function isAuthEndpoint(endpoint: string): boolean {
  // Credential and verification failures do not mean an existing session expired.
  const path = endpoint.split(/[?#]/, 1)[0]?.replace(/^\/api(?=\/)/, "") ?? endpoint;
  return [
    "/auth/login",
    "/auth/register",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/google",
  ].includes(path);
}

export function getAuthTokenRevision(): number {
  const token = getAuthToken();
  if (lastAuthToken === undefined) {
    lastAuthToken = token;
  } else if (lastAuthToken !== token) {
    lastAuthToken = token;
    authTokenRevision += 1;
  }
  return authTokenRevision;
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  const currentToken = localStorage.getItem("northpeak_token");
  if (currentToken !== token) {
    lastAuthToken = token;
    authTokenRevision += 1;
  }
  if (token) {
    localStorage.setItem("northpeak_token", token);
    if (currentToken !== token) {
      handlingAuthFailure = false;
      tokenStoredHandler?.();
    }
  } else {
    localStorage.removeItem("northpeak_token");
  }
}

export async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(buildApiUrl(endpoint), {
    ...options,
    headers,
  });

  if (!response.ok) {
    // A tokened API 401 means the server no longer accepts this session.
    if (response.status === 401 && token && !isAuthEndpoint(endpoint) && !handlingAuthFailure) {
      handlingAuthFailure = true;
      authFailureHandler?.();
    }
    let errorMsg = `Request failed: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData?.message) errorMsg = errorData.message;
    } catch {
      // response is not json
    }
    throw new Error(errorMsg);
  }

  return response.json() as Promise<T>;
}
