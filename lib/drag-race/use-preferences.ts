"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";
export type DragRacePreferences={animations_enabled:boolean;sounds_enabled:boolean;player_autoplay:boolean;player_volume:number};
export const DEFAULT_DRAG_RACE_PREFERENCES:DragRacePreferences={animations_enabled:true,sounds_enabled:true,player_autoplay:false,player_volume:0.8};
export function useDragRacePreferences(){
 const db=useMemo(()=>createClient(),[]);
 const [preferences,setPreferences]=useState<DragRacePreferences>(DEFAULT_DRAG_RACE_PREFERENCES);
 const [loaded,setLoaded]=useState(false);const [saving,setSaving]=useState(false);
 useEffect(()=>{let active=true;(async()=>{const {data:{user}}=await db.auth.getUser();if(!user){if(active)setLoaded(true);return;}const {data}=await db.from("drag_race_user_preferences").select("animations_enabled,sounds_enabled,player_autoplay,player_volume").eq("user_id",user.id).maybeSingle();if(active){if(data)setPreferences({animations_enabled:data.animations_enabled,sounds_enabled:data.sounds_enabled,player_autoplay:data.player_autoplay,player_volume:Number(data.player_volume)});setLoaded(true);}})();return()=>{active=false;};},[db]);
 const update=useCallback(async(patch:Partial<DragRacePreferences>)=>{const previous=preferences;const next={...preferences,...patch};setPreferences(next);setSaving(true);try{const {data:{user}}=await db.auth.getUser();if(!user)throw new Error("Accedi per salvare le preferenze.");const {error}=await db.from("drag_race_user_preferences").upsert({user_id:user.id,...next,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(error)throw error;}catch(error){setPreferences(previous);throw error;}finally{setSaving(false);}},[db,preferences]);
 return{preferences,update,loaded,saving};
}