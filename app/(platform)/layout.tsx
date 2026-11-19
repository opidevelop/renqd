import "./renq-data-lifecycle.css";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlatformShell } from "@/components/platform-shell";
import { getProfileMediaUrl } from "@/lib/supabase/profile-media";
import "./platform.css";
import "./multiplayer.css";
import "./profile-phase5.css";
import "./inbox.css";
import "./admin-management.css";
import "./moderation.css";
import "./social.css";
export const dynamic = "force-dynamic";
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile, error } = await supabase.from("profiles").select("username, role, status").eq("id", user.id).maybeSingle();
  if (error || !profile) redirect("/login?error=profile");
  if (profile.status !== "APPROVED") {
    const status = profile.status === "PENDING" ? "pending" : profile.status === "REJECTED" ? "rejected" : "suspended";
    redirect("/login?status=" + status);
  }
  let { data: publicProfile } = await supabase.from("public_profiles").select("user_id, avatar_url, display_name, media_settings").eq("user_id", user.id).maybeSingle();
  if (!publicProfile) {
    const { data: created } = await supabase.from("public_profiles").insert({ user_id: user.id, username: profile.username, display_name: profile.username }).select("user_id, avatar_url, display_name, media_settings").single();
    publicProfile = created;
  }
  const metadataAvatar = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
  const avatarUrl = publicProfile?.avatar_url ? await getProfileMediaUrl(supabase, publicProfile.avatar_url) : (typeof metadataAvatar === "string" ? metadataAvatar : null);
  const mediaSettings=(publicProfile as {media_settings?:{avatar?:{x?:number;y?:number;zoom?:number}}}|null)?.media_settings?.avatar;
  const avatarPosition={x:Math.max(0,Math.min(100,Number(mediaSettings?.x??50))),y:Math.max(0,Math.min(100,Number(mediaSettings?.y??50)))};
  const avatarZoom=Math.max(100,Math.min(200,Number(mediaSettings?.zoom??100)));
  return <PlatformShell avatarUrl={avatarUrl} avatarPosition={avatarPosition} avatarZoom={avatarZoom} displayName={publicProfile?.display_name ?? profile.username} username={profile.username} role={profile.role}>{children}</PlatformShell>;
}