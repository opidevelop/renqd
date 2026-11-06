"use client";

import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    "expired-callback"?: () => void;
    "error-callback"?: () => void;
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetId) return;
      const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      if (!siteKey) {
        setFailed(true);
        return;
      }
      widgetId = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: "auto",
        callback: (value) => {
          setToken(value);
          setFailed(false);
        },
        "expired-callback": () => setToken(""),
        "error-callback": () => {
          setToken("");
          setFailed(true);
        },
      });
      setReady(true);
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById("cloudflare-turnstile") as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.id = "cloudflare-turnstile";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
      script.addEventListener("error", () => setFailed(true));
      if (window.turnstile) renderWidget();
    }

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, []);

  return (
    <div className="auth-captcha">
      <div ref={containerRef} />
      <input type="hidden" name="captchaToken" value={token} />
      {failed && <p className="auth-captcha-error">Verifica di sicurezza non disponibile. Ricarica la pagina e riprova.</p>}
      {!ready && !failed && <p className="auth-captcha-hint">Caricamento verifica di sicurezza…</p>}
    </div>
  );
}
