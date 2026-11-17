import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function statusPath(status: string | undefined) {
  if (status === "PENDING") return "pending";
  if (status === "REJECTED") return "rejected";
  if (status === "SUSPENDED") return "suspended";
  return "profile";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const isRecovery = Boolean(tokenHash && url.searchParams.get("next") === "/reset-password");
  const next = isRecovery ? "/reset-password" : "/home";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL("/login?error=callback_config", request.url));
  }

  // Keep auth cookies on the exact response returned by this Route Handler.
  const response = NextResponse.redirect(new URL(next, request.url));
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  let error: { message: string } | null = null;

  if (code) {
    const result = await supabase.auth.exchangeCodeForSession(code);
    error = result.error;
  } else if (tokenHash && isRecovery) {
    const result = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    error = result.error;
  } else {
    error = { message: "Missing authentication code." };
  }

  if (error) {
    return NextResponse.redirect(new URL("/login?error=callback", request.url));
  }

  if (code) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.redirect(new URL("/login?error=profile", request.url));

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile || profile.status !== "APPROVED") {
      const status = profileError || !profile ? "profile" : statusPath(profile.status);
      const loginResponse = NextResponse.redirect(new URL("/login?status=" + status, request.url));
      response.cookies.getAll().forEach(cookie => loginResponse.cookies.set(cookie));
      return loginResponse;
    }
  }

  return response;
}
