"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Users,X,UserRound,ArrowUpRight} from "lucide-react";
type FollowProfile={userId:string;username:string|null;displayName:string;avatarUrl:string|null};
export function ProfileFollowLists({followerCount,followingCount,followers,following}:{followerCount:number;followingCount:number;followers:FollowProfile[];following:FollowProfile[]}){
 const[open,setOpen]=useState<"followers"|"following"|null>(null);
 const entries=open==="followers"?followers:following;
 const title=open==="followers"?"I tuoi follower":"I profili che segui";
 useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";return()=>{document.body.style.overflow=previous;};},[open]);
 return <div className="profile-follow-lists">
  <button type="button" onClick={()=>setOpen("followers")}><Users size={14}/><strong>{followerCount}</strong> Follower</button>
  <button type="button" onClick={()=>setOpen("following")}><UserRound size={14}/><strong>{followingCount}</strong> Seguiti</button>
  {open&&<div className="profile-follow-modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(null);}}>
   <section className="profile-follow-modal" role="dialog" aria-modal="true" aria-labelledby="profile-follow-modal-title">
    <header><div><span>LA TUA COMMUNITY</span><h2 id="profile-follow-modal-title">{title}</h2></div><button type="button" aria-label="Chiudi" onClick={()=>setOpen(null)}><X size={18}/></button></header>
    <div className="profile-follow-modal-list">{entries.length?entries.map(entry=><div className="profile-follow-modal-entry" key={entry.userId}>
      <span className="profile-follow-modal-avatar">{entry.avatarUrl?<img src={entry.avatarUrl} alt=""/>:<b>{entry.username?entry.displayName.slice(0,1).toUpperCase():<UserRound size={17}/>}</b>}</span>
      <span className="profile-follow-modal-copy"><strong>{entry.displayName}</strong>{entry.username&&<small>@{entry.username}</small>}{!entry.username&&<small>Informazioni non visibili</small>}</span>
      {entry.username&&<Link href={"/u/"+entry.username} onClick={()=>setOpen(null)} aria-label={"Apri il profilo di "+entry.username}><ArrowUpRight size={16}/></Link>}
    </div>):<div className="profile-follow-modal-empty">Ancora nessun profilo in questa lista.</div>}</div>
   </section>
  </div>}
 </div>;
}
