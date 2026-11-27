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
  const visible=reports.filter(report=>filter==="ALL"||report.status===filter);

  async function updateStatus(report:CatalogReport,status:CatalogReport["status"]) {
    setBusy(report.id);setError("");
    const {data:{user}}=await db.auth.getUser();
    if(!user){setError("Sessione scaduta. Accedi nuovamente.");setBusy(null);return;}
    const resolved=status==="RESOLVED"||status==="REJECTED";
    const {data,error:saveError}=await db.from("drag_race_catalog_reports").update({
      status,updated_at:new Date().toISOString(),resolved_by:resolved?user.id:null,resolved_at:resolved?new Date().toISOString():null,
    }).eq("id",report.id).select("*").single();
    if(saveError||!data){setError("Non è stato possibile aggiornare la segnalazione.");setBusy(null);return;}
    setReports(old=>old.map(item=>item.id===report.id?data as CatalogReport:item));
    setBusy(null);
  }

  return <section className={styles.wrap}>
    <header className={styles.header}><div><span>DRAG RACE · CATALOGO</span><h2>Segnalazioni dati</h2><p>Controlla le correzioni inviate dalla community e aggiorna il loro stato.</p></div><strong>{reports.filter(r=>r.status==="OPEN").length} aperte</strong></header>
    <div className={styles.toolbar}><label>Stato<select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="OPEN">Aperte</option><option value="IN_REVIEW">In revisione</option><option value="RESOLVED">Risolte</option><option value="REJECTED">Respinte</option><option value="ALL">Tutte</option></select></label><span>{visible.length} segnalazioni</span></div>
    {error&&<p className={styles.error} role="alert">{error}</p>}
    {visible.length===0?<div className={styles.empty}>Nessuna segnalazione in questa sezione.</div>:<div className={styles.list}>{visible.map(report=><article className={styles.card} key={report.id}>
      <div className={styles.cardTop}><span className={styles.kind}>{report.entity_type==="QUEEN"?"QUEEN":"LIPSYNC"}</span><time>{new Date(report.created_at).toLocaleString("it-IT")}</time></div>
      <h3>{report.entity_name}</h3><p className={styles.reason}>{reasonLabels[report.reason]??report.reason}</p>
      {report.details&&<p className={styles.details}>{report.details}</p>}
      <div className={styles.meta}>ID record: <code>{report.entity_id}</code> · Segnalante: <code>{report.reporter_id.slice(0,8)}</code>{report.source_url&&<> · <a href={report.source_url} target="_blank" rel="noreferrer">Fonte</a></>}</div>
      <div className={styles.controls}><label>Stato<select value={report.status} disabled={busy===report.id} onChange={e=>void updateStatus(report,e.target.value as CatalogReport["status"])}>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>{busy===report.id&&<span>Salvataggio…</span>}</div>
    </article>)}</div>}
  </section>;
}
