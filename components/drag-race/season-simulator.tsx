"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {sortTrackRecordQueens,type TrackRecordPlacementScore} from "@/lib/drag-race/track-record";
import {ArrowLeft,ArrowRight,Check,Crown,LoaderCircle,Plus,RefreshCw,Save,Shuffle,Trash2,Upload} from "lucide-react";

type Queen={id:string;name:string;aliases:string[];image_url:string|null;image_path?:string|null;franchiseCodes:string[];custom?:boolean};
type Franchise={code:string;name:string};
type SeasonOption={id:string;franchise_code:string;season_number:number;year:number|null;name:string;cast_ids:string[]};
type Song={id:string;song_title:string;song_artist:string|null;preview_url:string|null;apple_music_url:string|null};
type Relationship={id:string;a:string;b:string;type:string;strength:number;history:string[]};
type Placement="WIN"|"HIGH"|"SAFE"|"LOW"|"BTM2"|"ELIM";
type SimEpisode={
 number:number;title:string;challenge:string;miniChallenge:string|null;miniChallengeWinnerId:string|null;narrative:string;judgeFormat:string;eliminatedId:string|null;
 placements:Record<string,Placement>;comments:Record<string,string>;challengeWinnerId:string;
 bottomIds:string[];songId:string|null;lipsyncWinnerId:string|null;immuneId:string|null;
 goldenBeaverSaveId:string|null;outcome:"ELIMINATION"|"DOUBLE_SHANTAY"|"DOUBLE_SASHAY"|"NO_ELIMINATION";
 eliminatedIds:string[];untucked:boolean;completed:boolean;
};
type SavedSummary={id:string;title:string¶»§q«^