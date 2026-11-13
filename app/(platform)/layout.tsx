import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlatformShell } from "@/components/platform-shell";
import "./platform.css";
export const dynamic = "force-dynamic";
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles").select("username, role, status").eq("id", user.id).maybeSingle();
  if (error || !profile) redirect("/login?error=profile");
  if (profile.status === "PENDING") redirect("/pending");
  if (profile.status !== "APPROVED") redirect("/access-denied");
  const { data: publicProfile } = await supabase.from("public_profiles").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!publicProfile) await supabase.from("public_profiles").insert({ user_id: user.id, username: profile.username, display_name: profile.username });
  return <PlatformShell>{children}</PlatformShell>;
}
