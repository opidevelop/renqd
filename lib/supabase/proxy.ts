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

const LIMITED_ACCOUNT_PATHS = new Set([
  "/login",
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

function accountStatusPath(status: string | null | undefined) {
  switch (status) {
    case "PENDING": return "pending";
    case "REJECTED": return "rejected";
    case "SUSPENDED": return "suspended";
    default: return "profile";
  }
}

function redirectToLogin(request: NextRequest, response: NextResponse, status?: string) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/login";
  destination.search = "";
  if (status) destination.searchParams.set("status", status);
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
    return redirectToLogin(request, response, "profile");
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

  // Verify the JWT before using its subject as an identity.
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    if (LIMITED_ACCOUNT_PATHS.has(pathname)) return response;
    if (isApiPath(pathname)) {
      return copyCookies(response, NextResponse.json({ error: "Profilo non disponibile." }, { status: 403 }));
    }
    return redirectToLogin(request, response, "profile");
  }

  if (profile.status !== "APPROVED") {
    if (LIMITED_ACCOUNT_PATHS.has(pathname)) return response;
    const status = accountStatusPath(profile.status);
    if (isApiPath(pathname)) {
      return copyCookies(response, NextResponse.json({ error: "Account non ancora abilitato.", status }, { status: 403 }));
    }
    return redirectToLogin(request, response, status);
  }

  if (pathname === "/login" || pathname === "/register") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/home";
    destination.search = "";
    return copyCookies(response, NextResponse.redirect(destination));
  }

  return response;
}
