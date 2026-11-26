"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import Link from "next/link";
import {CatalogReportButton} from "@/components/drag-race/catalog-report-button";
import {createClient} from "@/lib/supabase/client";
import {useDragRacePreferences} from "@/lib/drag-race/use-preferences";
import {ArrowLeft,Check,SkipForward,Music2,Search,LoaderCircle,PartyPopper} from "lucide-react";
type Franchise={code:string;name:string};
type Season={id:string;franchise_code:string;season_number:number;name:string};
type Queen={id:string;name:string;aliases:string[];image_url:string|null};
type Lipsync={id:string;season_id:string;song_title:string;song_artist:string;queen_ids:string[];preview_url:string;apple_music_url:string|null;source_version:string|null};
type Props={franchises:Franchise[];seasons:Season[];queens:Queen[];lipsyncs:Lipsync[]};
const norm=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"").trim();
export function GuessTheLipsyncGame({franchises,seasons,queens,lipsyncs}:Props){
 const [selectedFranchises,setSelectedFranchises]=useState<string[]>(franchises.map(x=>x.code));
 const [selectedSeasons,setSelectedSeasons]=useState<string[]>([]);
 const [allSeasons,setAllSeasons]=useState(true);
 const [amount,setAmount]=useState("10");
 const [queue,setQueue]=useState<Lipsync[]>([]);
 const [index,setIndex]=useState(0);
 const [found,setFound]=useState<string[]>([]);
 const [errorSlots,setErrorSlots]=useState<n¶»§q«^