"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Search,Users,LockKeyhole,Trophy,ArrowUpRight,Sparkles,LoaderCircle} from "lucide-react";
import {ProfileFollowButton} from "@/components/profile-follow-button";
type UserItem={userId:string;username:string;displayName:string;avatarUrl:string|null;isPrivate:boolean;followStatus:string|null;followerCount:number};
type RankingItem={id:string;slug:string;title:string;mode:string;coverImageUrl:string|null;creator:{username:string;displayName:string;avatarUrl:string|null}};
export function SocialDiscover(){
 const[query,setQuery]=useState("");const[users,setUsers]=useState<UserItem[]>([]);const[rankings,setRankings]=useState<RankingItem[]>([]);const[loading,setLoading]=useState(true);const[error,setError]=useState("");
 useEffect(()=>{
  const controller=new AbortController();
  const timer=window.setTimeout(async()=>{
   setLoading(true);setError("");
   try{const response=await fetch("/api/social/discover?q="+encodeURIComponent(query.trim()),{signal:controller.signal,cache:"no-store"});const data=await response.json();if(!response.ok)throw new Error(data.error??"Ricerca non disponibile.");setUsers(data.users??[]);setRankings(data.rankings??[]);}
   catch(e){if(e instanceof Error&&e.name==="AbortError")return;setError(e instanceof Error?e.message:"Ricerca non disponibile.");}
   finally{if(!controller.signal.aborted)setLoading(false);}
  },query.trim()?260:0);
  return()=>{window.clearTimeout(timer);controller.abort();};
 },[query]);
 const searched=query.trim().length>=2;
 return <section className="social-discover"><div className="social-section-heading"><div><span>COMMUNITY RENQD</span><h2>{searched?"I risultati della ricerca":"Persone da seguire"}</h2><p>{searched?"Cerca profili e classifiche pubblicate.":"Scopri nuovi profili e classifiche della community."}</p></div><Sparkles size={20}/></div><label className="social-search"><Search size={18}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Cerca persone, username o Renq…" aria-label="Cerca persone o classifiche"/></label>{error&&<p className="social-error" role="alert">{error}</p>}{loading?<div className="social-loading"><LoaderCircle size={18}/> Sto cercando…</div>:<><div className="social-results-grid"><section><div className="social-subheading"><Users size={16}/><h3>Persone</h3><span>{users.length}</span></div>{users.length?users.map(user=><article className="social-user-card" key={user.userId}><div className="social-user-avatar">{user.avatarUrl?<img src={user.avatarUrl} alt=""/>:<span>{user.displayName.slice(0,1).toUpperCase()}</span>}</div><div className="social-user-copy">{user.isPrivate&&<small className="social-private-label"><LockKeyhole size={11}/> Profilo privato</small>}{user.isPrivate?<strong>@{user.username}</strong>:<Link href={"/u/"+user.username}><strong>{user.displayName}</strong><small>@{user.username}</small></Link>}</div><ProfileFollowButton targetUserId={user.userId}/></article>):<p className="social-empty">{searched?"Nessun profilo trovato.":"Non ci sono ancora nuovi profili da suggerire."}</p>}</section><section><div className="social-subheading"><Trophy size={16}/><h3>Renq da scoprire</h3><span>{rankings.length}</span></div>{rankings.length?rankings.map(item=><Link href={"/r/"+(item.slug||item.id)} className="social-ranking-card" key={item.id}><div className="social-ranking-cover" style={item.coverImageUrl?{backgroundImage:"linear-gradient(0deg,rgba(20,17,14,.75),rgba(20,17,14,.08)),url("+item.coverImageUrl+")"}:undefined}><span>{item.mode.replaceAll("_"," ")}</span><ArrowUpRight size={16}/></div><strong>{item.title}</strong><small>di @{item.creator.username}</small></Link>):<p className="social-empty">{searched?"Nessuna classifica trovata.":"Le nuove classifiche pubbliche appariranno qui."}</p>}</section></div></>}</section>;
}