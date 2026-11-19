"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Check, ImagePlus, LoaderCircle, Pencil, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type CollectionData = { id:string; title:string; description:string; visibility:"PUBLIC"|"PRIVATE"; banner_url:string|null };
type CollectionItem = { id:string; title:string; public_slug:string|null; mode:string };
type SearchItem = { id:string; title:string; coverImage:string|null; rows:unknown[] };

export function CollectionDetailManager({collection,initialItems,initialEditing=false}:{collection:CollectionData;initialItems:CollectionItem[];initialEditing?:boolean}) {
  const router=useRouter();
  const [open,setOpen]=useState(initialEditing);
  const [title,setTitle]=useState(collection.title);
  const [description,setDescription]=useState(collection.description);
  const [visibility,setVisibility]=useState(collection.visibility);
  const [items,setItems]=useState(initialItems);
  const [query,setQuery]=useState("");
  const [results,setResults]=useState<SearchItem[]>([]);
  const [selected,setSelected]=useState<string[]>([]);
  const [loadingSearch,setLoadingSearch]=useState(false);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const [error,setError]=useState("");

  useEffect(()=>{let active=true;const q=query.trim();if(q.length<2){const timer=window.setTimeout(()=>{if(active){setResults([]);setLoadingSearch(false);}},0);return()=>{active=false;window.clearTimeout(timer);};}const controller=new AbortController();const timer=window.setTimeout(async()=>{setLoadingSearch(true);try{const response=await fetch("/api/my-renqs?q="+encodeURIComponent(q),{signal:controller.signal,cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error??"Ricerca non disponibile.");if(active)setResults(data.items??[]);}catch(e){if(e instanceof Error&&e.name!=="AbortError"&&active)setError(e.message);}finally{if(active)setLoadingSearch(false);}},250);return()=>{active=false;window.clearTimeout(timer);controller.abort();};},[query]);

  async function saveDetails(){if(!title.trim())return;setBusy(true);setError("");setFeedback("");try{const supabase=createClient();const {error}=await supabase.from("profile_collections").update({title:title.trim().slice(0,70),description:description.trim().slice(0,240),visibility}).eq("id",collection.id);if(error)throw error;setFeedback("Cartella aggiornata.");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Salvataggio non riuscito.");}finally{setBusy(false);}}
  async function persistOrder(next:CollectionItem[]){const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sessione scaduta.");const {error:deleteError}=await supabase.from("profile_collection_items").delete().eq("collection_id",collection.id);if(deleteError)throw deleteError;const {error:insertError}=await supabase.from("profile_collection_items").insert(next.map((item,position)=>({collection_id:collection.id,ranking_id:item.id,owner_id:user.id,position})));if(insertError)throw insertError;}
  async function moveItem(index:number,direction:-1|1){const target=index+direction;if(target<0||target>=items.length||busy)return;const next=[...items];[next[index],next[target]]=[next[target],next[index]];setBusy(true);setError("");try{await persistOrder(next);setItems(next);setFeedback("Ordine aggiornato.");}catch(e){setError(e instanceof Error?e.message:"Riordino non riuscito.");router.refresh();}finally{setBusy(false);}}
  async function removeItem(id:string){if(busy)return;const next=items.filter(item=>item.id!==id);setBusy(true);setError("");try{await persistOrder(next);setItems(next);setFeedback("Renq rimosso dalla cartella.");}catch(e){setError(e instanceof Error?e.message:"Rimozione non riuscita.");router.refresh();}finally{setBusy(false);}}
  async function addSelected(){if(!selected.length||busy)return;setBusy(true);setError("");try{const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sessione scaduta.");const additions=selected.filter(id=>!items.some(item=>item.id===id));const {data:rankings,error:readError}=await supabase.from("rankings").select("id,title,public_slug,mode").in("id",additions).eq("user_id",user.id).eq("status","COMPLETED");if(readError)throw readError;const {error}=await supabase.from("profile_collection_items").insert(additions.map((id,index)=>({collection_id:collection.id,ranking_id:id,owner_id:user.id,position:items.length+index})));if(error)throw error;setItems(current=>[...current,...(rankings??[])]);setSelected([]);setQuery("");setResults([]);setFeedback("Renq aggiunti alla cartella.");}catch(e){setError(e instanceof Error?e.message:"Aggiunta non riuscita.");}finally{setBusy(false);}}
  async function uploadBanner(file:File|null){if(!file)return;if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024){setError("Scegli un'immagine JPG, PNG o WebP fino a 8 MB.");return;}setBusy(true);setError("");try{const supabase=createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sessione scaduta.");const ext=file.type==="image/jpeg"?"jpg":file.type==="image/png"?"png":"webp";const path=user.id+"/collection-banner-"+crypto.randomUUID()+"."+ext;const {error:uploadError}=await supabase.storage.from("profile-media").upload(path,file,{contentType:file.type,cacheControl:"31536000"});if(uploadError)throw uploadError;const {error:updateError}=await supabase.from("profile_collections").update({banner_url:path}).eq("id",collection.id);if(updateError)throw updateError;setFeedback("Banner aggiornato.");router.refresh();}catch(e){setError(e instanceof Error?e.message:"Caricamento banner non riuscito.");}finally{setBusy(false);}}
  return <section className="collection-detail-manager">
    <div className="collection-detail-manager-top"><div><span>GESTIONE COLLEZIONE</span><strong>{items.length} Renq nella cartella</strong></div><button type="button" onClick={()=>setOpen(value=>!value)} aria-expanded={open}><Pencil size={15}/>{open?"Chiudi modifiche":"Gestisci cartella"}</button></div>
    {open&&<div className="collection-detail-manager-panel">
      <div className="profile-edit-grid"><label>Nome cartella<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={70}/></label><label>Visibilità<select value={visibility} onChange={e=>setVisibility(e.target.value as "PUBLIC"|"PRIVATE")}><option value="PUBLIC">Pubblica</option><option value="PRIVATE">Privata</option></select></label><label className="profile-edit-wide">Descrizione<input value={description} onChange={e=>setDescription(e.target.value)} maxLength={240}/></label><label className="profile-edit-wide profile-file-field"><ImagePlus size={15}/> Banner della cartella<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void uploadBanner(e.target.files?.[0]??null)}/></label></div>
      <button type="button" className="profile-save-button" onClick={()=>void saveDetails()} disabled={busy||!title.trim()}><Check size={15}/> Salva modifiche</button>
      <div className="collection-detail-manager-items"><strong>Renq inclusi e ordinamento</strong>{items.map((item,index)=><div className="profile-collection-item-row" key={item.id}><Link href={"/renq/"+(item.public_slug||item.id)}>{item.title}</Link><span><button type="button" disabled={busy||index===0} onClick={()=>void moveItem(index,-1)} aria-label="Sposta Renq su"><ArrowUp size={14}/></button><button type="button" disabled={busy||index===items.length-1} onClick={()=>void moveItem(index,1)} aria-label="Sposta Renq giù"><ArrowDown size={14}/></button><button type="button" disabled={busy} onClick={()=>void removeItem(item.id)} aria-label="Rimuovi Renq"><X size={14}/></button></span></div>)}{!items.length&&<p>Nessun Renq in questa cartella.</p>}</div>
      <div className="collection-detail-add"><strong>Aggiungi Renq</strong><label><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cerca tra i tuoi Renq…"/></label>{loadingSearch&&<small><LoaderCircle size={13}/> Ricerca in corso…</small>}{results.filter(item=>!items.some(existing=>existing.id===item.id)).map(item=><button type="button" key={item.id} className={selected.includes(item.id)?"is-selected":""} onClick={()=>setSelected(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id])}><span>{item.title}</span><Plus size={15}/></button>)}{selected.length>0&&<button type="button" className="profile-save-button" onClick={()=>void addSelected()} disabled={busy}>Aggiungi {selected.length} selezionati</button>}</div>
    </div>}
    {error&&<p className="collection-detail-feedback is-error" role="alert">{error}</p>}{feedback&&<p className="collection-detail-feedback" role="status">{feedback}</p>}
  </section>;
}
