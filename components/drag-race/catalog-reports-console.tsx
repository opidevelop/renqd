"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./catalog-reports-console.module.css";

export type CatalogReport = {
  id: string;
  reporter_id: string;
  entity_type: "QUEEN" | "LIPSYNC";
  entity_id: string;
  entity_name: string;
  reason: string;
  details: string | null;
  source_url: string | null;
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "REJECTED";
  created_at: string;
  updated_at: string;
  resolution_note: string | null;
};

const reasonLabels: Record<string,string> = {
  WRONG_NAME:"Nome errato",WRONG_ALIAS:"Alias errato o mancante",WRONG_ORIGIN:"Origine o franchise errato",
  WRONG_APPEARANCE:"Partecipazione o posizione errata",WRONG_CHALLENGE:"Challenge o risultato errato",
  WRONG_LIPSYNC_SONG:"Brano del lipsync errato",WRONG_ARTIST:"Artista errato",BROKEN_PREVIEW:"Anteprima audio non funzionante",
  DUPLICATE:"Record duplicato",OTHER:"Altro problema",
};
const statusLabels: Record<CatalogReport["status"],string> = {OPEN:"Aperta",IN_REVIEW:"In revisione",RESOLVED:"Risolta",REJECTED:"Respinta"};

export function CatalogReportsConsole({initialReports}:{initialReports:CatalogReport[]}) {
  const db=useMemo(()=>createClient(),[]);
  const [reports,setReports]=useState(initialReports);
  const [filter,setFilter]=useState<"ALL"|CatalogReport["status"]>("OPEN");
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState("");
  const visible=reports.fi¶»§q«^