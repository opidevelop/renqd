import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
]);

function isApiPath(pathname: string) {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function copyCookies(source: NextResponse, target: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

function redirectToLogin(request: NextRequest, response: NextResponse) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/login";
  destination.search = "";
  return copyCookies(response, NextResponse.redirect(destination));
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    if (PUBLIC_PATHS.has(request.nextUrl.pathname)) return response;
    if (isApiPath(request.nextUrl.pathname)) {
      return NextResponse.json({ error: "Servizio di autenticazione non disponibile." }, { status: 503 });
    }
    return redirectToLogin(request, response);
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // Verify the JWT for an optimistic identity check. Account approval is
  // enforced by protected layouts, API handlers and database RLS policies.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const userId = !claimsError && typeof claimsData?.claims?.sub === "string"
    ? claimsData.claims.sub
    : null;
  const pathname = request.nextUrl.pathname;

  if (!userId) {
    if (PUBLIC_PATHS.has(pathname)) return response;
    if (isApiPath(pathname)) {
      return copyCookies(response, NextResponse.json({ error: "Autenticazione richiesta." }, { status: 401 }));
    }
    return redirectToLogin(request, response);
  }

  // A signed-in user should use the login screen for account status and
  // cannot create a second registration session in the same browser.
  if (pathname === "/register") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/login";
    destination.search = "";
    return copyCookies(response, NextResponse.redirect(destination));
  }

  return response;
}
