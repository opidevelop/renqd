"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback"?: () => void;
    "error-callback"?: (errorCode?: string | number) => boolean | void;
    theme?: "auto" | "light" | "dark";
  }) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export default function TurnstileField() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [errorCode, setErrorCode] = useState<string | number | null>(null);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    let script: HTMLScriptElement | null = null;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetId) return;
      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      if (!siteKey) {
        setErrorCode("SITE_KEY_MISSING");
        return;
      }

      try {
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "auto",
          callback: (value) => {
            setToken(value);
            setErrorCode(null);
          },
          "expired-callback": () => setToken(""),
          "error-callback": (code) => {
            console.error("[Renqd] Cloudflare Turnstile error:", code ?? "unknown");
            setToken("");
            setErrorCode(code ?? "UNKNOWN");
            return false;
          },
        });
        setReady(true);
      } catch (error) {
        console.error("[Renqd] Turnstile render failed:", error);
        setErrorCode("RENDER_FAILED");
      }
    };

    const onScriptLoad = () => renderWidget();
    const onScriptError = () => setErrorCode("SCRIPT_LOAD_FAILED");

    if (window.turnstile) {
      renderWidget();
    } else {
      script = document.getElementById("cloudflare-turnstile") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "cloudflare-turnstile";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      script.addEventListener("load", onScriptLoad);
      script.addEventListener("error", onScriptError);

      // A script tag may already exist and have completed loading before this component mounted.
      if (window.turnstile) renderWidget();
    }

    return () => {
      cancelled = true;
      script?.removeEventListener("load", onScriptLoad);
      script?.removeEventListener("error", onScriptError);
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  return (
    <div className="auth-captcha">
      <div ref={containerRef} />
      <input type="hidden" name="captchaToken" value={token} />
      {errorCode !== null && (
        <p className="auth-captcha-error">
          Verifica di sicurezza non disponibile (codice: {errorCode}). Ricarica la pagina e riprova.
        </p>
      )}
      {!ready && errorCode === null && (
        <p className="auth-captcha-hint">Caricamento verifica di sicurezza…</p>
      )}
    </div>
  );
}
