import type { SupabaseClient, User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function getAccountAccess(supabase: SupabaseClient): Promise<{
  user: User | null;
  status: string;
}> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { user: null, status: "UNAUTHENTICATED" };

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return { user, status: "PROFILE_ERROR" };
  return { user, status: String(profile.status) };
}

export async function requireApprovedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) redirect("/login?status=profile");
  if (profile.status !== "APPROVED") {
    const status = profile.status === "PENDING" ? "pending" : profile.status === "REJECTED" ? "rejected" : "suspended";
    redirect("/login?status=" + status);
  }

  return { supabase, user, profile };
}
