"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {CatalogReportButton} from "@/components/drag-race/catalog-report-button";
import {createClient} from "@/lib/supabase/client";
import {useDragRacePreferences} from "@/lib/drag-race/use-preferences";
import {ArrowLeft,Crown,Check,StopCircle,LoaderCircle} from "lucide-react";
type Queen={id:string;name:string;aliases:string[];image_url:string|null;franchiseCodes:string[]};
type Season={id:string;name:string;franchise_code:string;season_number:number};
type Song={id:string;season_id:string;song_title:string;song_artist:string|null;preview_url:string|null;apple_music_url:string|null;source_version:string|null};
const shuffle=<T,>(items:T[])=>[...items].sort(()=>Math.random()-.5);
const pickRandom=<T,>(items:T[])=>items.length?items[Math.floor(Math.random()*items.length)]:undefined;
type Props={franchises:{code:string;name:string}[];seasons:Season[];queens:Queen[];songs:Song[]};
export function LipsyncForYourLifeGame({franchises,seasons,queens,songs}:Props){
 const db=useMemo(()=>createClient(),[]);const {preferences}=useDragRacePreferences();const playerRef=useRef<HTMLAudioElement>(null);
 const [selected,setSelected]=useState(franchises.map(x=>x.code));const [allSeasons,setAllSeasons]=useState(true);const [seasonIds,setSeasonIds]=useState<string[]>([]);
 const [started,setStarted]=useState(false);const [busy,setBusy]=useState(false);const [sessionId,setSessionId]=useState<¶»§q«^