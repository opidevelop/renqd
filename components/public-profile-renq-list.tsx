"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Trophy } from "lucide-react";

type PublicRenq={id:string;title:string;public_slug:string|null;mode:string;settings:Record<string,unknown>|null};

export function PublicProfileRenqList({items,displayName}:{items:PublicRenq[];displayName:string}) {
  const [page,setPage]=useState(1);
  const pageSize=6;
  const pageCount=Math.max(1,Math.ceil(items.length/pageSize));
  const visible=items.slice((page-1)*pageSize,page*pageSize);
  return <section className="profile-renqs-section">
    <div className="profile-section-heading"><div><span>CLASSIFICHE PUBBLICATE</span><h2>I Renq di {displayName}</h2></div><Trophy size={20}/></div>
    {items.length?<><div className="profile-renq-grid">{visible.map(ranking=>{const settings=ranking.settings??{};const cover=typeof settings.coverImageUrl==="string"?settings.coverImageUrl:null;return <Link key={ranking.id} href={"/r/"+(ranking.public_slug||ranking.id)} className="profile-renq-card"><div style={cover?{backgroundImage:"linear-gradient(0deg,rgba(15,12,10,.75),rgba(15,12,10,.05)),url("+cover+")"}:undefined}><span>{ranking.mode.replaceAll("_"," ")}</span><ArrowUpRight size={17}/></div><strong>{ranking.title}</strong></Link>;})}</div><div className="profile-pagination"><span>{(page-1)*pageSize+1}–{Math.min(page*pageSize,items.length)} di {items.length}</span><div><button type="button" disabled={page===1} onClick={()=>setPage(value=>Math.max(1,value-1))}>Precedente</button><strong>{page} / {pageCount}</strong><button type="button" disabled={page===pageCount} onClick={()=>setPage(value=>Math.min(pageCount,value+1))}>Successiva</button></div></div></>:<div className="profile-empty-state"><Trophy size={23}/><strong>Nessun Renq pubblico disponibile</strong></div>}
  </section>;
}
