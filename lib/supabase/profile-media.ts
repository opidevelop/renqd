import type { SupabaseClient } from "@supabase/supabase-js";

export function profileMediaObjectPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const markers = [
    "/storage/v1/object/public/profile-media/",
    "/storage/v1/object/sign/profile-media/",
    "/storage/v1/object/authenticated/profile-media/",
  ];
  for (const marker of markers) {
    const index = value.indexOf(marker);
    if (index >= 0) {
      const rawPath = value.slice(index + marker.length).split("?")[0];
      try { return decodeURIComponent(rawPath); } catch { return rawPath; }
    }
  }
  return value.startsWith("http://") || value.startsWith("https://") ? null : value;
}

export async function getProfileMediaUrl(
  supabase: SupabaseClient,
  value: string | null | undefined,
): Promise<string | null> {
  if (!value) return null;
  const path = profileMediaObjectPath(value);
  if (!path) return value.startsWith("http://") || value.startsWith("https://") ? value : null;
  const { data, error } = await supabase.storage.from("profile-media").createSignedUrl(path, 60 * 60);
  return error ? null : data.signedUrl;
}
