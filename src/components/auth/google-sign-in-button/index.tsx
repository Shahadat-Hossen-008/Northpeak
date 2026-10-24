import { useEffect, useRef } from "react";
import type { GoogleSignInButtonProps } from "./interface";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const SCRIPT_URL = "https://accounts.google.com/gsi/client";

export function GoogleSignInButton({
  role,
  onSuccess,
  onError,
  disabled,
}: GoogleSignInButtonProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const successRef = useRef(onSuccess);
  const errorRef = useRef(onError);
  const clientId = import.meta.env["VITE_GOOGLE_CLIENT_ID"];

  useEffect(() => {
    successRef.current = onSuccess;
    errorRef.current = onError;
  }, [onSuccess, onError]);

  useEffect(() => {
    if (!clientId) return;
    let disposed = false;
    const mountElement = mountRef.current;
    const drawButton = () => {
      if (disposed || !mountElement || !window.google) return;
      mountElement.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          void (async () => {
            try {
              const { authApi } = await import("@/backend/auth");
              const data = await authApi.googleSignIn(credential, role);
              successRef.current(data.user.role);
            } catch (error) {
              errorRef.current(error instanceof Error ? error.message : "Google sign-in failed.");
            }
          })();
        },
      });
      window.google.accounts.id.renderButton(mountElement, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width: Math.min(mountElement.clientWidth, 400),
      });
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    if (window.google) drawButton();
    else if (existingScript) existingScript.addEventListener("load", drawButton, { once: true });
    else {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.defer = true;
      script.onload = drawButton;
      script.onerror = () => errorRef.current("Google sign-in could not load. Try again later.");
      document.head.appendChild(script);
    }

    return () => {
      disposed = true;
      mountElement?.replaceChildren();
    };
  }, [clientId, role]);

  if (!clientId) return null;

  return (
    <div
      ref={mountRef}
      aria-label="Continue with Google"
      aria-disabled={disabled}
      className={`min-h-10 max-w-100 mx-auto ${disabled ? "pointer-events-none opacity-60" : ""}`}
    />
  );
}

export default GoogleSignInButton;
export type { GoogleSignInButtonProps } from "./interface";
