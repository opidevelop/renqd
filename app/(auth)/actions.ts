"use server";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
async function requestOrigin() {
 const h=await headers(); const host=h.get("x-forwarded-host")??h.get("host");
 const isPreview=Boolean(host&&/^renqd-[a-z0-9-]+-opiteam\.vercel\.app$/.test(host));
 const allowed=host==="renqd.app"||host==="renqd.vercel.app"||host==="localhost:3000"||isPreview;
 const safeHost=allowed&&host?host:"renqd.app"; return (safeHost==="localhost:3000"?"http":"https")+"://"+safeHost;
}
function validPassword(p:string){return p.length>=8&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p);}
export async function signIn(formData:FormData){
 const email=String(formData.get("email")??"").trim().toLowerCase(),password=String(formData.get("password")??""),captchaToken=String(formData.get("captchaToken")??"");
 if(!email||!password)redirect("/login?error=missing"); if(!captchaToken)redirect("/login?error=captcha");
 const supabase=await createClient(); const {error}=await supabase.auth.signInWithPassword({email,password,options:{captchaToken}});
 if(error)redirect("/login?error=credentials"); redirect("/home");
}
export async function signUp(formData:FormData){
 const email=String(formData.get("email")??"").trim().toLowerCase(),username=String(formData.get("username")??"").trim().toLowerCase(),password=String(formData.get("password")??""),captchaToken=String(formData.get("captchaToken")??"");
 if(!email||!username||!validPassword(password))redirect("/register?error=validation"); if(!captchaToken)redirect("/register?error=captcha"); if(!/^[a-z0-9_]{3,30}$/.test(username))redirect("/register?error=username");
 const supabase=await createClient(),origin=await requestOrigin(); const {error}=await supabase.auth.signUp({email,password,options:{data:{username},emailRedirectTo:origin+"/auth/callback?next=/home",captchaToken}});
 if(error)redirect("/register?error=signup"); redirect("/register?checkEmail=1");
}
export async function requestPasswordReset(formData:FormData){
 const email=String(formData.get("email")??"").trim().toLowerCase(),captchaToken=String(formData.get("captchaToken")??"");
 if(!email)redirect("/forgot-password?error=missing"); if(!captchaToken)redirect("/forgot-password?error=captcha");
 const supabase=await createClient(),origin=await requestOrigin();
 const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:origin+"/auth/callback?next=/reset-password",captchaToken});
 if(error){console.error("[Renqd] Password recovery request failed:",{code:error.code,message:error.message});if(error.code==="captcha_failed")redirect("/forgot-password?error=captcha");if(error.code==="over_email_send_rate_limit"||error.code==="over_request_rate_limit")redirect("/forgot-password?error=rate");redirect("/forgot-password?error=send");}
 redirect("/forgot-password?sent=1");
}
export async function updatePassword(formData:FormData){
 const password=String(formData.get("password")??""); if(!validPassword(password))redirect("/reset-password?error=policy");
 const supabase=await createClient(); const {error}=await supabase.auth.updateUser({password});
 if(error){console.error("[Renqd] Password update failed:",{code:error.code,message:error.message});if(error.code==="same_password")redirect("/reset-password?error=same");if(error.code==="weak_password")redirect("/reset-password?error=policy");if(error.code==="session_not_found"||error.code==="invalid_token")redirect("/reset-password?error=expired");redirect("/reset-password?error=update");}
 redirect("/home");
}
export async function signOut(){const supabase=await createClient();await supabase.auth.signOut();redirect("/login");}
