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
  let { data: publicProfile } = await supabase.from("public_profiles").select("user_id, avatar_url, display_name").eq("user_id", user.id).maybeSingle();
  if (!publicProfile) {
    const { data: created } = await supabase.from("public_profiles").insert({ user_id: user.id, username: profile.username, display_name: profile.username }).select("user_id, avatar_url, display_name").single();
    publicProfile = created;
  }
  const metadataAvatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  const avatarUrl = publicProfile?.avatar_url ?? (typeof metadataAvatar === "string" ? metadataAvatar : null);
  return <PlatformShell avatarUrl={avatarUrl} displayName={publicProfile?.display_name ?? profile.username} username={profile.username}>{children}</PlatformShell>;
}