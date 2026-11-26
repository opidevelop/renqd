"use client";

import { useState, type FormEvent } from "react";
import { Flag, LoaderCircle, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import styles from "./catalog-report-button.module.css";

type EntityType = "QUEEN" | "LIPSYNC";
type Reason = "WRONG_NAME" | "WRONG_ALIAS" | "WRONG_ORIGIN" | "WRONG_APPEARANCE" | "WRONG_CHALLENGE" | "WRONG_LIPSYNC_SONG" | "WRONG_ARTIST" | "BROKEN_PREVIEW" | "DUPLICATE" | "OTHER";

const labels: Record<Reason, string> = {
  WRONG_NAME: "Nome errato",
  WRONG_ALIAS: "Alias errato o mancante",
  WRONG_ORIGIN: "Origine o franchise errato",
  WRONG_APPEARANCE: "Partecipazione o posizione errata",
  WRONG_CHALLENGE: "Challenge o risultato catalogato male",
  WRONG_LIPSYNC_SONG: "Brano del lipsync errato",
  WRONG_ARTIST: "Artista errato",
  BROKEN_PREVIEW: "Anteprima audio non funzionante",
  DUPLICATE: "Record duplicato",
  OTHER: "Altro problema",
};

export function CatalogReportButton({
  entityType,
  entityId,
  entityName,
  sourceUrl,
  sourceVersion,
}: {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  sourceUrl?: string | null;
  sourceVersion?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason>(entityType === "QUEEN" ? "WRONG_NAME" : "WRONG_LIPSYNC_SONG");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useS¶»§q«^