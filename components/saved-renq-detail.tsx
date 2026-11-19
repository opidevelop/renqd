"use client";

import { useRef, useState } from "react";
import { useConfirmDialog } from "@/components/confirm-dialog";
import type { FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Heart, MessageCircle, Pencil, Play, Plus, RotateCcw, Send, Share2, Trophy, Trash2, Users, X } from "lucide-react";
import { RenqCoverPicker } from "@/components/renq-cover-picker";
import { highQualityImageUrl } from "@/lib/image-quality";
import { RenqReveal } from "@/components/renq-reveal";
import { RenqSortableList, getRenqRankPositions } from "@/components/renq-ranking-ui";

type SavedItem = {
  id: string;
  title: string;
  image_url?: string | null;
  description?: string | null;
  rank_position?: number | null;
  tie_group_id?: string | null;
  score?: number | null;
  tie_order?: number | null;
  metadata?: { previewUrl?: string | null };
};
type CommentItem = { id: string; body: string; created_at: string; author_id: string };
type RevisionItem = { id: string; version: number; change_summary: string | null; created_at: string };
type Props = {
  ranking: { id: string; public_slug?: string; title: string; mode: string; settings: Record<string, unknown>; created_at: string; visibility?: string; allow_ties: boolean; started_at?: string | null; completed_at?: string | null };
  items: SavedItem[];
  coverImageUrl: string | null;
  coverImagePath: string | null;
  defaultCoverImageUrl: string | null;
  coverPosition: { x: number; y: number };
  comments: CommentItem[];
  commentCount: number;
  initialLiked: boolean;
  likeCount: number;
  revisions: RevisionItem[];
  isMultiplayer?: boolean;
};

const modeLabels: Record<string, string> = { RENQ: "Renq", BATTLE_RENQ: "Battle Renq", SPEED_RENQ: "Speed Renq", GRADE: "Grade" };
type GradeConfig={criterion:"score"|"position";labels:{name:string;min:number;max:number;color:string}[]};
function gradeLabelFor(score:number| null|undefined,position:number,config:GradeConfig){if(score===null||score===undefined)return null;const value=config.criterion==="score"?score:position;return config.labels.find(label=>label.name.trim()&&value>=label.min&&value<=label.max)??null;}

export function SavedRenqDetail({ ranking, items, coverImageUrl, coverImagePath, defaultCoverImageUrl, coverPosition: initialCoverPosition, comments: initialComments, commentCount: initialCommentCount, initialLiked, likeCount: initialLikeCount, revisions, isMultiplayer=false }: Props) {
  const router = useRouter();
  const { confirm, dialog } = useConfirmDialog();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [comments, setComments] = useState(initialComments);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [comment, setComment] = useState("");
  const [liked, setLiked] = useState(initialLiked);
  const [likes, setLikes] = useState(initialLikeCount);
  const [currentCoverUrl, setCurrentCoverUrl] = useState(coverImageUrl);
  const [currentCoverPath, setCurrentCoverPath] = useState(coverImagePath);
  const [currentCoverPosition, setCurrentCoverPosition] = useState(initialCoverPosition);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [showReveal, setShowReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentTitle, setCurrentTitle] = useState(ranking.title);
  const [displayItems, setDisplayItems] = useState(items);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(ranking.title);
  const [editItems, setEditItems] = useState(items);
  const [editTieMap, setEditTieMap] = useState<Record<string,string>>(() => Object.fromEntries(items.filter(item => item.tie_group_id).map(item => [item.id, item.tie_group_id as string])));
  const [editGradeConfig,setEditGradeConfig]=useState<GradeConfig>(()=>((ranking.settings?.gradeConfig as GradeConfig|undefined)??{criterion:"score",labels:[]}));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggedIds, setDraggedIds] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number|null>(null);
  const latestEditItemsRef = useRef(items);
  const dragStartRef = useRef<number|null>(null);
  const draggedIdsRef = useRef<string[]>([]);

  async function post(body: Record<string, unknown>) {
    const response = await fetch("/api/rankings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "Operazione non riuscita.");
    return result;
  }

  async function toggleFavorite() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await post({ action: "toggle-like", rankingId: ranking.id });
      setLiked(Boolean(result.liked));
      setLikes(Number(result.likeCount ?? likes));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile aggiornare i preferiti.");
    } finally { setBusy(false); }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = comment.trim();
    if (!body || busy) return;
    setBusy(true); setError("");
    try {
      const result = await post({ action: "add-comment", rankingId: ranking.id, body });
      setComments(current => [...current, result.comment]);
      setCommentCount(current => current + 1);
      setComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile pubblicare il commento.");
    } finally { setBusy(false); }
  }

  function startEditing() {
    setEditTitle(currentTitle);
    setEditItems(displayItems);
    setEditGradeConfig((ranking.settings?.gradeConfig as GradeConfig|undefined)??{criterion:"score",labels:[]});
    latestEditItemsRef.current = displayItems;
    setEditTieMap(Object.fromEntries(displayItems.filter(item => item.tie_group_id).map(item => [item.id, item.tie_group_id as string])));
    setSelectedIds([]);
    setEditing(true);
    setError("");
    setMessage("");
  }

  function cancelEditing() {
    setEditing(false);
    setSelectedIds([]);
    setDraggedIds([]);
    setDragIndex(null);
    dragStartRef.current = null;
    draggedIdsRef.current = [];
  }

  function moveGradeEdit(index:number,direction:-1|1) {
    const next=[...editItems],target=index+direction;
    if(target<0||target>=next.length)return;
    if(next[index].score===null||next[index].score===undefined||next[index].score!==next[target].score)return;
    const firstOrder=next[index].tie_order??index,secondOrder=next[target].tie_order??target;
    const firstItem=next[index],secondItem=next[target];
    next[index]={...secondItem,tie_order:firstOrder};
    next[target]={...firstItem,tie_order:secondOrder};
    setEditItems(next);
  }

  function moveEdit(index:number,direction:-1|1) {
    const next=[...latestEditItemsRef.current];
    const target=index+direction;
    if(target<0||target>=next.length)return;
    [next[index],next[target]]=[next[target],next[index]];
    latestEditItemsRef.current=next;
    setEditItems(next);
  }

  function shiftSelectedEdit(targetId:string) {
    const current=latestEditItemsRef.current;
    const movingIds=draggedIdsRef.current;
    if(!movingIds.length||movingIds.includes(targetId))return;
    const movingSet=new Set(movingIds);
    const moving=current.filter(item=>movingSet.has(item.id));
    const rest=current.filter(item=>!movingSet.has(item.id));
    const target=rest.findIndex(item=>item.id===targetId);
    if(target<0)return;
    const next=[...rest.slice(0,target),...moving,...rest.slice(target)];
    if(next.every((item,index)=>item.id===current[index]?.id))return;
    latestEditItemsRef.current=next;
    setEditItems(next);
    setDragIndex(target);
  }

  function finishEditDrag() {
    dragStartRef.current=null;
    draggedIdsRef.current=[];
    setDraggedIds([]);
    setDragIndex(null);
  }

  function toggleEditTie(index:number) {
    if(!ranking.allow_ties||index===0)return;
    const current=editItems[index],previous=editItems[index-1],next={...editTieMap};
    const currentGroup=next[current.id],previousGroup=next[previous.id];
    if(currentGroup&&currentGroup===previousGroup){
      delete next[current.id];
      const remaining=Object.entries(next).filter(([,group])=>group===currentGroup);
      if(remaining.length===1)delete next[remaining[0][0]];
    }else{
      const group=currentGroup??previousGroup??crypto.randomUUID();
      for(const [id,value] of Object.entries(next))if(value===currentGroup||value===previousGroup)next[id]=group;
      next[current.id]=group;next[previous.id]=group;
    }
    setEditTieMap(next);
  }

  async function repeatBattle() {
    if(busy||!(await confirm({title:"Avviare una nuova Battle?",description:"La classifica attuale resterà nella cronologia e potrai costruirne una nuova da zero.",confirmLabel:"Avvia nuova Battle"})))return;
    setBusy(true);setError("");setMessage("");
    try{
      await post({action:"repeat-battle",rankingId:ranking.id});
      router.push("/renq/"+(ranking.public_slug??ranking.id));
      router.refresh();
    }catch(e){
      setError(e instanceof Error?e.message:"Non è stato possibile ripetere la Battle.");
      setBusy(false);
    }
  }

  async function savePublishedChanges() {
    if(busy)return;
    const cleanTitle=editTitle.trim();
    if(!cleanTitle||cleanTitle.length>80){setError("Il titolo deve contenere da 1 a 80 caratteri.");return;}
    setBusy(true);setError("");setMessage("");
    try{
      if(ranking.mode==="GRADE"){
        const scores:Record<string,number>={};
        for(const item of editItems){if(item.score===null||item.score===undefined)continue;if(!Number.isFinite(Number(item.score))||Number(item.score)<0||Number(item.score)>10||Math.round(Number(item.score)*10)!==Number(item.score)*10)throw new Error("I voti devono essere da 0 a 10 con un solo decimale.");scores[item.id]=Number(item.score);}
        if(Object.keys(scores).length===0)throw new Error("Assegna almeno un voto prima di salvare il Grade.");
        const tieOrder=Object.fromEntries(editItems.filter(item=>item.score!==null&&item.score!==undefined).map((item,index)=>[item.id,item.tie_order??index]));
        const result=await post({action:"update-grade",rankingId:ranking.id,title:cleanTitle,scores,tieOrder,gradeConfig:editGradeConfig});
        const nextItems=(result.items as SavedItem[]).map(item=>({...item,title:item.title,score:item.score===null||item.score===undefined?null:Number(item.score),tie_order:Number(item.tie_order??0)}));
        setDisplayItems(nextItems);setEditItems(nextItems);setCurrentTitle(cleanTitle);setEditing(false);setSelectedIds([]);setMessage("Voti ed etichette aggiornati nella cronologia.");router.refresh();return;
      }
      const result=await post({action:"update-published-renq",rankingId:ranking.id,title:cleanTitle,orderedIds:editItems.map(item=>item.id),tieMap:editTieMap});
      const sortable=editItems.map((item,index)=>({...item,title_snapshot:item.title,sort_order:index,image_url:item.image_url??null,description:item.description??null,rank_position:item.rank_position??null,preview_url:item.metadata?.previewUrl??null}));const positions=getRenqRankPositions(sortable,editTieMap);
      const nextItems=editItems.map(item=>({...item,rank_position:positions[item.id]??null,tie_group_id:editTieMap[item.id]??null}));
      setDisplayItems(nextItems);
      setCurrentTitle(result.title??cleanTitle);
      setEditing(false);
      setSelectedIds([]);
      setMessage("Modifiche salvate nella cronologia.");
      router.refresh();
    }catch(e){
      setError(e instanceof Error?e.message:"Non è stato possibile salvare le modifiche.");
    }finally{setBusy(false);}
  }

  async function deleteRanking() {
    if (busy || !(await confirm({title:"Spostare il Renq nel cestino?",description:"Potrai ripristinarlo in seguito dalla sezione Cestino.",confirmLabel:"Sposta nel cestino",tone:"danger"}))) return;
    setBusy(true); setError("");
    try {
      await post({ action: "delete-renq", rankingId: ranking.id });
      router.push("/rankings");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile eliminare il Renq.");
      setBusy(false);
    }
  }

  async function shareRanking() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: currentTitle, text: "La mia classifica su Renqd", url });
      else { await navigator.clipboard.writeText(url); setError("Link copiato negli appunti."); }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") setError("Non è stato possibile condividere il Renq.");
    }
  }
  async function saveCover(path: string | null, previewUrl: string | null, position = currentCoverPosition) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await post({ action: "update-cover", rankingId: ranking.id, coverImagePath: path, coverImageUrl: path ? null : (previewUrl && previewUrl !== defaultCoverImageUrl ? previewUrl : null), coverPosition: position });
      setCurrentCoverPath(path);
      setCurrentCoverPosition(position);
      setCurrentCoverUrl(previewUrl ?? defaultCoverImageUrl);
      setMessage("Copertina aggiornata e registrata nella cronologia.");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile aggiornare la copertina.");
    } finally { setBusy(false); }
  }


  const settings = ranking.settings ?? {};
  const gradeRatedItems=displayItems.filter(item=>item.score!==null&&item.score!==undefined);
  const currentGradeAverage=gradeRatedItems.length?Number((gradeRatedItems.reduce((sum,item)=>sum+Number(item.score),0)/gradeRatedItems.length).toFixed(1)):null;
  const category = String(settings.category ?? "custom").replaceAll("_", " ");
  const contentType = String(settings.contentType ?? "Lista personalizzata");
  const rawCover = currentCoverUrl || defaultCoverImageUrl || displayItems.find(item => item.image_url)?.image_url || null;
  const cover = highQualityImageUrl(rawCover);
  const sortableEditItems=editItems.map((item,index)=>({...item,title_snapshot:item.title,sort_order:index,image_url:item.image_url??null,description:item.description??null,rank_position:item.rank_position??null,preview_url:item.metadata?.previewUrl??null}));
  const editPositions=getRenqRankPositions(sortableEditItems,editTieMap);

  if (showReveal) return <div className="saved-renq-page saved-renq-reveal-page"><button className="saved-renq-back" type="button" onClick={() => setShowReveal(false)}><ArrowLeft size={17}/> Torna alla classifica</button><RenqReveal title={currentTitle} mode={ranking.mode} category={String(settings.category ?? "custom")} contentType={contentType} coverImageUrl={rawCover} coverPosition={currentCoverPosition} allowTies={displayItems.some(item => Boolean(item.tie_group_id))} gradeAverage={currentGradeAverage} items={displayItems.map(item => {const position=item.rank_position??0;const label=ranking.mode==="GRADE"&&item.score!==null&&item.score!==undefined?gradeLabelFor(Number(item.score),position,(settings.gradeConfig as GradeConfig|undefined)??{criterion:"score",labels:[]}):null;return {id:item.id,title:item.title,image_url:item.image_url??null,description:item.description??null,rank_position:item.rank_position??null,tie_group_id:item.tie_group_id??null,preview_url:item.metadata?.previewUrl??null,score:item.score??null,gradeLabel:label?.name??null,gradeColor:label?.color??null};})} actions={<button type="button" className="renq-save-button" onClick={() => setShowReveal(false)}>Torna alla classifica</button>} /></div>;

  return (
    <main className="saved-renq-page">
      <Link href="/rankings" className="saved-renq-back"><ArrowLeft size={17} /> I miei Renq</Link>
      <section className="saved-renq-hero">
        {cover ? <img className="saved-renq-cover" src={cover} alt="" style={{ objectPosition: `${currentCoverPosition.x}% ${currentCoverPosition.y}%` }} /> : <div className="saved-renq-cover saved-renq-cover-empty"><Trophy size={58} /></div>}
        <div className="saved-renq-cover-shade" />
        {!isMultiplayer&&<div className="saved-renq-cover-controls">
          <button type="button" className="saved-renq-cover-edit" onClick={() => setCoverEditorOpen(value => !value)} aria-label="Modifica copertina" aria-expanded={coverEditorOpen}><Pencil size={17} /></button>
          {coverEditorOpen && <div className="saved-renq-cover-editor"><RenqCoverPicker value={currentCoverUrl ?? defaultCoverImageUrl ?? displayItems.find(item => item.image_url)?.image_url ?? null} onChange={(path,url) => void saveCover(path,url)} onFocusPreview={position => setCurrentCoverPosition(position)} onFocusChange={position => void saveCover(currentCoverPath,currentCoverUrl,position)} focusPosition={currentCoverPosition} onReset={() => void saveCover(null,null,{x:50,y:50})} canReset={Boolean(currentCoverPath)||(Boolean(currentCoverUrl)&&currentCoverUrl!==defaultCoverImageUrl)||currentCoverPosition.x!==50||currentCoverPosition.y!==50} variant="overlay"/></div>}
        </div>}
        <div className="saved-renq-hero-copy">
          <span>{modeLabels[ranking.mode] ?? "Renq"} · {category} · {contentType}</span>
          <div className="saved-renq-title-line"><h1>{currentTitle}</h1>{ranking.mode==="GRADE"&&<strong className="saved-grade-average">{currentGradeAverage===null?"—":currentGradeAverage.toFixed(1).replace(".",",")}<small>/10</small></strong>}</div>
          <p>{displayItems.length} elementi{ranking.mode === "SPEED_RENQ" && ranking.started_at && ranking.completed_at ? " · Tempo impiegato " + Math.floor(Math.max(0,new Date(ranking.completed_at).getTime()-new Date(ranking.started_at).getTime())/60000) + "m " + String(Math.floor(Math.max(0,new Date(ranking.completed_at).getTime()-new Date(ranking.started_at).getTime())/1000)%60).padStart(2,"0") + "s" : ""} · Salvato il {new Date(String(settings.savedAt ?? ranking.created_at)).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="saved-renq-toolbar">
        {editing ? <>
          <button type="button" onClick={cancelEditing} disabled={busy}><X size={16}/><span>Annulla</span></button>
          <button type="button" onClick={() => void savePublishedChanges()} disabled={busy || !editTitle.trim()}><Check size={16}/><span>{busy ? "Salvataggio…" : "Salva modifiche"}</span></button>
        </> : <button type="button" onClick={startEditing} disabled={busy}><Pencil size={17} /><span>Modifica</span></button>}
        {!editing && ranking.mode === "BATTLE_RENQ" && <button type="button" onClick={() => void repeatBattle()} disabled={busy}><RotateCcw size={16}/><span>Ripeti Battle</span></button>}
        {ranking.visibility === "REVEAL" && <button type="button" onClick={() => setShowReveal(true)}><Play size={17} /><span>Rivedi reveal</span></button>}
        <button type="button" onClick={() => void shareRanking()}><Share2 size={17} /><span>Condividi</span></button>
        <button type="button" onClick={() => void toggleFavorite()} disabled={busy} className={liked ? "is-liked" : ""}><Heart size={17} fill={liked ? "currentColor" : "none"} /><span>{liked ? "Nei preferiti" : "Preferiti"}</span><small>{likes}</small></button>
        {isMultiplayer?<Link href={"/multiplayer/"+ranking.id} className="saved-renq-session-link"><Users size={16}/><span>Sessione multiplayer</span></Link>:<button type="button" className="saved-renq-delete" onClick={() => void deleteRanking()} disabled={busy}><Trash2 size={16}/><span>Elimina</span></button>}

        </div>
      </section>

      <section className="saved-renq-ranking">
        <div className="saved-renq-section-heading"><div><span>IL RISULTATO</span><h2>La tua classifica</h2></div><Trophy size={21} /></div>
        {editing ? <div className="saved-renq-editor">
          <label className="saved-renq-edit-title">Titolo del Renq<input value={editTitle} onChange={event=>setEditTitle(event.target.value)} maxLength={80}/></label>
          {ranking.mode==="GRADE"?<div className="grade-saved-editor">
            <label className="grade-criterion-edit">Etichette assegnate per<select value={editGradeConfig.criterion} onChange={event=>{const criterion=event.target.value as "score"|"position";const ranges=criterion==="position"?[[1,1],[2,5],[6,10],[11,2147483647]]:[[9.5,10],[8,9.4],[6,7.9],[0,5.9]];setEditGradeConfig(current=>({...current,criterion,labels:current.labels.map((label,index)=>({...label,min:ranges[index]?.[0]??(criterion==="score"?0:1),max:ranges[index]?.[1]??(criterion==="score"?10:100)}))}));}}><option value="score">Intervallo di voto</option><option value="position">Posizione in classifica</option></select></label>
            <div className="grade-label-editor">{editGradeConfig.labels.map((label,index)=><div className="grade-label-edit-row" key={index}><input value={label.name} placeholder={["Win","High","Safe","Low"][index]??"Nuova etichetta"} maxLength={28} aria-label="Nome etichetta" onChange={event=>setEditGradeConfig(current=>({...current,labels:current.labels.map((entry,i)=>i===index?{...entry,name:event.target.value}:entry)}))}/><label>Da<input type="number" min="0" max={editGradeConfig.criterion==="score"?10:2147483647} step={editGradeConfig.criterion==="score"?"0.1":"1"} value={label.min} onChange={event=>setEditGradeConfig(current=>({...current,labels:current.labels.map((entry,i)=>i===index?{...entry,min:Number(event.target.value)}:entry)}))}/></label><label>A<input type="number" min="0" max={editGradeConfig.criterion==="score"?10:2147483647} step={editGradeConfig.criterion==="score"?"0.1":"1"} value={label.max} onChange={event=>setEditGradeConfig(current=>({...current,labels:current.labels.map((entry,i)=>i===index?{...entry,max:Number(event.target.value)}:entry)}))}/></label><input type="color" value={label.color} aria-label="Colore etichetta" onChange={event=>setEditGradeConfig(current=>({...current,labels:current.labels.map((entry,i)=>i===index?{...entry,color:event.target.value}:entry)}))}/><button type="button" className="grade-label-remove" onClick={()=>setEditGradeConfig(current=>({...current,labels:current.labels.filter((_,i)=>i!==index)}))} aria-label={"Rimuovi etichetta "+(label.name||index+1)}><X size={14}/></button></div>)}{editGradeConfig.labels.length===0&&<p className="grade-label-empty">Nessuna etichetta: puoi aggiungerne una quando vuoi.</p>}<button type="button" className="grade-label-add" onClick={()=>setEditGradeConfig(current=>({...current,labels:[...current.labels,{name:"",min:current.criterion==="score"?0:1,max:current.criterion==="score"?10:2147483647,color:["#e58a32","#8c72cf","#4c9b82","#9b9690","#d46d86","#4b8eae"][current.labels.length%6]}]}))}><Plus size={15}/> Aggiungi etichetta</button></div>
            {editItems.map((item,index)=><article className="grade-saved-edit-row" key={item.id}>{item.image_url?<img src={item.image_url} alt=""/>:<span className="saved-renq-item-placeholder"><Trophy size={17}/></span>}<strong>{item.title}</strong><label><input type="number" min="0" max="10" step="0.1" value={item.score??""} onChange={event=>setEditItems(current=>current.map((entry,i)=>i===index?{...entry,score:event.target.value===""?null:Number(event.target.value)}:entry))}/><small>/10</small></label><span className="grade-tie-controls"><button type="button" disabled={item.score===null||item.score===undefined||index===0||editItems[index-1]?.score!==item.score} onClick={()=>moveGradeEdit(index,-1)} aria-label="Sposta su nel pari merito">↑</button><button type="button" disabled={item.score===null||item.score===undefined||index===editItems.length-1||editItems[index+1]?.score!==item.score} onClick={()=>moveGradeEdit(index,1)} aria-label="Sposta giù nel pari merito">↓</button></span></article>)}
          </div>:<><p>Riordina gli elementi trascinandoli o usando le frecce. Seleziona più elementi con Ctrl (Windows), Command (Mac) o con le caselle su mobile.</p>
          <RenqSortableList items={sortableEditItems} positions={editPositions} allowTies={ranking.allow_ties} tieMap={editTieMap} onToggleTie={toggleEditTie} onMove={moveEdit} showDragHandle dragIndex={dragIndex} draggedIds={draggedIds} selectedIds={selectedIds} onToggleSelect={id=>setSelectedIds(current=>current.includes(id)?current.filter(value=>value!==id):[...current,id])} onDragStart={(index,event)=>{event.preventDefault();const id=latestEditItemsRef.current[index]?.id;if(!id)return;const group=selectedIds.includes(id)?selectedIds:[id];draggedIdsRef.current=group;setDraggedIds(group);setSelectedIds(group);dragStartRef.current=index;setDragIndex(index);event.currentTarget.parentElement?.setPointerCapture(event.pointerId);}} onDragMove={(index,event)=>{if(dragStartRef.current===null||event.buttons===0)return;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest("[data-renq-index]");const targetIndex=Number(target?.getAttribute("data-renq-index"));const targetId=latestEditItemsRef.current[targetIndex]?.id;if(targetId){shiftSelectedEdit(targetId);dragStartRef.current=targetIndex;}}} onDragEnd={finishEditDrag}/></>}
        </div> : <div className="saved-renq-list">
          {(ranking.mode==="GRADE"?displayItems.filter(item=>item.score!==null&&item.score!==undefined):displayItems).map((item, index) => {
            const position = item.rank_position ?? index + 1;
            const medal = position <= 3 ? ["🥇", "🥈", "🥉"][position - 1] : null;
            return <article className={"saved-renq-row" + (position <= 3 ? " is-top-" + position : "")} key={item.id}>
              <span className="saved-renq-position">{String(position).padStart(2, "0")}</span>
              {item.image_url ? <img src={highQualityImageUrl(item.image_url) ?? item.image_url} alt="" loading="lazy" /> : <span className="saved-renq-item-placeholder"><Trophy size={19} /></span>}
              <div className="saved-renq-item-copy"><strong>{item.title}</strong>{item.description && <small>{item.description}</small>}{ranking.mode==="GRADE"&&item.score!==null&&item.score!==undefined&&(()=>{const label=gradeLabelFor(Number(item.score),position,(settings.gradeConfig as GradeConfig|undefined)??{criterion:"score",labels:[]});return label?<span className="saved-grade-label" style={{color:label.color,backgroundColor:label.color+"18",borderColor:label.color+"55"}}>{label.name}</span>:null;})()}</div>
              {ranking.mode==="GRADE"&&item.score!==null&&item.score!==undefined&&<strong className="saved-grade-score">{Number(item.score).toFixed(1).replace(".",",")}<small>/10</small></strong>}
              {medal && <span className={"saved-renq-medal medal-" + position} aria-label={"Posizione " + position}>{medal}</span>}
            </article>;
          })}
        </div>}
        {ranking.mode==="GRADE"&&displayItems.some(item=>item.score===null||item.score===undefined)&&<div className="grade-published-unrated"><div className="grade-unrated-heading"><strong>Da valutare</strong><span>{displayItems.filter(item=>item.score===null||item.score===undefined).length}</span></div>{displayItems.filter(item=>item.score===null||item.score===undefined).map(item=><article className="grade-published-unrated-row" key={item.id}>{item.image_url?<img src={highQualityImageUrl(item.image_url)??item.image_url} alt="" loading="lazy"/>:<span className="saved-renq-item-placeholder"><Trophy size={17}/></span>}<div><strong>{item.title}</strong><small>Ancora senza voto</small></div></article>)}</div>}
      </section>

      <section className="saved-renq-comments saved-renq-history">
        <div className="saved-renq-section-heading"><div><span>TRACCIABILITÀ</span><h2>Cronologia <small>{revisions.length}</small></h2></div><Trophy size={21} /></div>
        {revisions.length ? <>
        <button type="button" className="saved-renq-history-toggle" onClick={() => setHistoryOpen(value => !value)} aria-expanded={historyOpen}><span>{historyOpen ? "Nascondi cronologia" : "Mostra cronologia"}</span><ChevronDown size={16} className={historyOpen ? "is-open" : ""}/></button>
        {historyOpen && <ol className="saved-renq-revision-list">{revisions.map(revision => <li key={revision.id}><strong>Versione {revision.version}</strong><span>{revision.change_summary || "Modifica classifica"}</span><time dateTime={revision.created_at}>{new Date(revision.created_at).toLocaleString("it-IT", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</time></li>)}</ol>}
      </> : <p className="saved-renq-no-comments">La cronologia verrà popolata automaticamente con le prossime modifiche.</p>}
      </section>

      <section className="saved-renq-comments">
        <div className="saved-renq-section-heading"><div><span>LA CONVERSAZIONE</span><h2>Commenti <small>{commentCount}</small></h2></div><MessageCircle size={21} /></div>
        <form className="saved-renq-comment-form" onSubmit={addComment}>
          <textarea value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} rows={2} placeholder="Aggiungi un commento…" />
          <button type="submit" disabled={!comment.trim() || busy} aria-label="Pubblica commento"><Send size={17} /></button>
        </form>
        {comments.length ? <div className="saved-renq-comment-list">{comments.map(item => <article key={item.id}><div className="saved-renq-comment-avatar">R</div><div><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small></div></article>)}</div> : <p className="saved-renq-no-comments">Ancora nessun commento. Apri tu la conversazione.</p>}
      </section>
      {(error || message) && <p className={"saved-renq-feedback" + (error ? " is-error" : " is-success")} role="status">{error || message}</p>}
      <div className="saved-renq-footer-mark">renqd<span>.</span></div>
      {dialog}
    </main>
  );
}
