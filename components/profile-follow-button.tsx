"use client";

import { useEffect, useState } from "react";
import { UserPlus, UserCheck, Clock3 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ProfileFollowButton({ targetUserId, isPrivate }: { targetUserId: string; isPrivate: boolean }) {
  const [status, setStatus] = useState<"none" | "PENDING" | "ACCEPTED">("none");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { let active = true; void (async () => { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (!user || user.id === targetUserId) return; const { data } = await supabase.from("user_follows").select("status").eq("follower_id", user.id).eq("followed_id", targetUserId).maybeSingle(); if (active && data) setStatus(data.status as "PENDING" | "ACCEPTED"); })(); return () => { active = false; }; }, [targetUserId]);
  async function toggle() {
    if (loading) return;
    setLoading(true); setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setMessage("Accedi per seguire questo profilo."); return; }
      if (user.id === targetUserId) return;
      const { data: existing, error: readError } = await supabase.from("user_follows").select("status").eq("follower_id", user.id).eq("followed_id", targetUserId).maybeSingle();
      if (readError) throw readError;
      if (existing) {
        const { error } = await supabase.from("user_follows").delete().eq("follower_id", user.id).eq("followed_id", targetUserId);
        if (error) throw error;
        setStatus("none");
      } else {
        const next = isPrivate ? "PENDING" : "ACCEPTED";
        const { error } = await supabase.from("user_follows").insert({ follower_id: user.id, followed_id: targetUserId, status: next });
        if (error) throw error;
        setStatus(next);
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Operazione non riuscita."); }
    finally { setLoading(false); }
  }
  return <div className="profile-follow-wrap"><button type="button" className="profile-follow-button" onClick={() => void toggle()} disabled={loading}>{status === "ACCEPTED" ? <><UserCheck size={16}/> Segui già</> : status === "PENDING" ? <><Clock3 size={16}/> Richiesta inviata</> : <><UserPlus size={16}/> Segui</>}</button>{message && <small>{message}</small>}</div>;
}
