"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {CatalogReportButton} from "@/components/drag-race/catalog-report-button";
import {createClient} from "@/lib/supabase/client";
import {useDragRacePreferences} from "@/lib/drag-race/use-preferences";
import {ArrowLeft,LoaderCircle,RefreshCw,Crown,Check} from "lucide-react";
type Queen={id:string;name:string;aliases:string[];image_url:string|null;franchiseCodes:string[]};
type Franchise={code:string;name:string};
type Song={id:string;song_title:string;song_artist:string|null;preview_url:string|null;apple_music_url:string|null;source_version:string|null};
type Match={id:string;a:string|null;b:string|null;songId:string|null;winner:string|null};
type Props={franchises:Franchise[];queens:Queen[];songs:Song[]};
const shuffle=<T,>(items:T[])=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
const pickRandom=<T,>(items:T[])=>items.length?items[Math.floor(Math.random()*items.length)]:undefined;
export function SlayoffGame({franchises,queens,songs}:Props){
 const db=useMemo(()=>createClient(),[]);const {preferences}=useDragRacePreferences();const playerRef=useRef<HTMLAudioElement>(null);
 const [count,setCount]=useState("8");const [custom,setCustom]=useState("12");const [selectedFranchises,setSelectedFranchises]=useState(franchises.map(x=>x.code));
 const [manual,setManual]=useState(false);¶»§q«^