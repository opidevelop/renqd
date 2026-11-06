"use server";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const allowed = host === "renqd.vercel.app" || host === "renqd.app" || host === "localhost:3000" || Boolean(host?.endsWith("-opiteam.vercel.app"));
  const safeHost = allowed && host ? host : "renqd.vercel.app";
  const protocol = safeHost === "localhost:3000" ? "http" : "https";
  return protocol + "://" + safeHost;
}
export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=missing");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  redirect("/home");
}
export async function signUp(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !username || password.length < 8) redirect("/register?error=validation");
  if (!/^[a-z0-9_]{3,30}$/.test(username)) redirect("/register?error=username");
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: origin + "/auth/callback?next=/home" } });
  if (error) redirect("/register?error=signup");
  redirect("/register?checkEmail=1");
}
export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/forgot-password?error=missing");
  const supabase = await createClient();
  const origin = await requestOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + "/auth/callback?next=/reset-password" });
  if (error) redirect("/forgot-password?error=send");
  redirect("/forgot-password?sent=1");
}
export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirect("/reset-password?error=validation");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect("/reset-password?error=update");
  redirect("/home");
}
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
