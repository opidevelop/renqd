import Link from "next/link";
import {ArrowLeft,ArrowUpRight,Trophy} from "lucide-react";
import {createClient} from "@/lib/supabase/server";
export const dynamic="force-dynamic";
type Entry={user_id:string;mode:string;franchise_code:string|null;games_started:number;games_completed:number;games_interrupted:number;queen_guessed_total:number;best_result:number|null;best_time_seconds:number|null;least_errors:number|null;least_hints:number|null;best_accuracy:number|null};
type PeriodEntry=Entry&{period_type:"WEEKLY"|"MONTHLY";period_start:string};
const labels:Record<string,string>={GUESS_THEM_ALL:"Guess Them All",GUESS_THE_LIPSYNC:"Guess the Lipsync",LIPSYNC_FOR_YOUR_LIFE:"Lipsync for Your Life",SLAYOFF:"Slayoff",SEASON_SIMULATOR:"Season Simulator"};
const modeLabel=(mode:string)=>labels[mode]??mode.replaceAll("_"," ").toLowerCase().replace(/\b\w/g,x=>x.toUpperCase());
const timeLabel=(seconds:number|null)=>seconds===null?"â€”":Math.floor(seconds/60)+"m "+String(seconds%60).padStart(2,"0")+"s";
const sortEntries=(a:Entry,b:Entry)=>{
 if(a.mode==="GUESS_THEM_ALL"&&b.mode==="GUESS_THEM_ALL")return (b.best_result??-1)-(a.best_result??-1)||(a.best_time_seconds??Infinity)-(b.best_time_seconds??Infinity)||(a.least_errors??Infinity)-(b.least_errors??Infinity)||(a.least_hints??Infinity)-(b.least_hints??Infinity);
 return (b.best_result??-1)-(a.best_result??-1)||(b.best_accuracy??-1)-(a.best_accuracy??-1)||(a.best_time_seconds??Infinity)-(b.best_time_seconds??Infinity)||b.games_completed¶»§q«^