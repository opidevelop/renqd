import Image from "next/image";
import Link from "next/link";
import {notFound} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import {ArrowLeft,Trophy,Star,Music,Mic2} from "lucide-react";
import {CatalogReportButton} from "@/components/drag-race/catalog-report-button";
export const dynamic="force-dynamic";
type QueenAppearance={seasonId:string;placement?:number;challengeWins?:Array<{episodeId:string;name:string}>;miniChallengeWins?:Array<{episodeId:string;name?:string}>;lipSyncWins?:Array<{episodeId:string;song:string}>;lipSyncLosses?:Array<{episodeId:string;song:string}>;disqualified?:boolean;quit?:boolean;reentered?:boolean};
type Season={id:string;franchise_code:string;season_number:number;year:number|null;name:string;winner_ids:string[];runner_up_ids:string[]};
export default async function DragRaceQueenPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)return null;
 const {data:queen}=await db.from("drag_race_queens").select("id,name,aliases,origin,appearances,image_url,source_url,source_version").eq("id",id).maybeSingle();
 if(!queen)notFound();
 const appearances=(queen.appearances??[]) as QueenAppearance[];
 const seasonIds=[...new Set(appearances.map(a=>a.seasonId).filter(Boolean))];
 const [seasonResult,franchiseResult]=await Promise.all([
  seasonIds.length?db.from("drag_race_seasons").select("id,franchise_code,season_number,year,nam¶»§q«^