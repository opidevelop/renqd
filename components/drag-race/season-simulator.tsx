"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import {createClient} from "@/lib/supabase/client";
import {FranchisePicker} from "@/components/drag-race/franchise-picker";
import {QueenCatalogImage} from "@/components/drag-race/queen-catalog-image";
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
type SavedSummary={id:string;title:string;created_at:string;statistics:Record<string,unknown>};
type Props={userId:string;franchises:Franchise[];seasons:SeasonOption[];queens:Queen[];songs:Song[];savedSeasons:SavedSummary[];scoringRules:TrackRecordPlacementScore[]};
const CHALLENGES=["Design challenge","Ball","Snatch Game","Acting challenge","Comedy challenge","Roast","Rusical","Girl groups","Improv","Branding challenge","Makeover","Sewing challenge","Advert challenge","Talent show","Interview"];
const MINI=["Reading challenge","Photo shoot","Mini ball","Dance challenge","Improv rapido","Quiz backstage","Runway sprint"];
const PLACEMENTS:Placement[]=["WIN","HIGH","SAFE","LOW","BTM2","ELIM"];
const RELATIONS=["Amiche","Alleate","Rivali","Nemiche","Ex","Mentor e protetta","Crush","Familiari","In competizione"];
const shuffle=<T,>(items:T[])=>{const out=[...items];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
const pick=<T,>(items:T[])=>items.length?items[Math.floor(Math.random()*items.length)]:undefined;
const comments=["Una performance precisa, carismatica e memorabile.","Il look racconta una storia, ma l'esecuzione può crescere.","Hai centrato il brief con personalità.","C'è un'idea forte, serve più controllo sul risultato.","La tua presenza scenica ha dominato la stanza.","Un risultato altalenante: alcuni momenti brillano, altri meno."];
const blankConfig={queenCount:"12",customCount:"12",premiereFormat:"STANDARD",returningFormat:"NONE",seasonFormat:"STANDARD",finaleFormat:"TOP3",finalistCount:"3",episodeCount:"10",doubleShantay:true,doubleSashay:false,challengeRiggory:false,lipsyncRiggory:false,immunity:false,goldenBeaver:false,fameGames:false,chocolateBar:false,chocolateMode:"RANDOM",chocolateQueenId:"",miniMode:"EVERY_EPISODE",judgeFormat:"STANDARD",untucked:true,otherTwists:""};
export function DragRaceSeasonSimulator({userId,franchises,seasons,queens,songs,savedSeasons,scoringRules}:Props){
 const db=useMemo(()=>createClient(),[]);
 const [stage,setStage]=useState<"setup"|"cast"|"relationships"|"episodes"|"finale"|"saved">("setup");
 const [config,setConfig]=useState({...blankConfig});
 const [selectedFranchises,setSelectedFranchises]=useState(franchises.map(x=>x.code));
 const [castMode,setCastMode]=useState<"RANDOM"|"CUSTOM"|"BY_SEASON">("RANDOM");
 const [cast,setCast]=useState<Queen[]>([]);
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [seasonId,setSeasonId]=useState("");
 const [queenSearch,setQueenSearch]=useState("");
 const [customName,setCustomName]=useState("");
 const [customImageUrl,setCustomImageUrl]=useState("");
 const [customQueens,setCustomQueens]=useState<Queen[]>([]);
 const [uploading,setUploading]=useState(false);
 const [relationshipMode,setRelationshipMode]=useState<"RANDOM"|"MANUAL">("RANDOM");
 const [relationships,setRelationships]=useState<Relationship[]>([]);
 const [pairA,setPairA]=useState("");
 const [pairB,setPairB]=useState("");
 const [pairType,setPairType]=useState("Rivali");
 const [sessionId,setSessionId]=useState<string|null>(null);
 const [activeIds,setActiveIds]=useState<string[]>([]);
 const [eliminatedIds,setEliminatedIds]=useState<string[]>([]);
 const [episodes,setEpisodes]=useState<SimEpisode[]>([]);
 const [episodeNumber,setEpisodeNumber]=useState(1);
 const [currentEpisode,setCurrentEpisode]=useState<SimEpisode|null>(null);
 const [finalists,setFinalists]=useState<string[]>([]);
 const [finaleSongId,setFinaleSongId]=useState("");
 const [winnerId,setWinnerId]=useState("");
 const [runnerUpId,setRunnerUpId]=useState("");
 const [thirdId,setThirdId]=useState("");
 const [title,setTitle]=useState("");
 const [notice,setNotice]=useState("");
 const [busy,setBusy]=useState(false);
 const [savedId,setSavedId]=useState<string|null>(null);
 const [returningUsed,setReturningUsed]=useState(false);
 const [fameScores,setFameScores]=useState<Record<string,number>>({});
 const [chocolateUsed,setChocolateUsed]=useState(false);
 const [premiereGroupTwo,setPremiereGroupTwo]=useState<string[]>([]);
 const [premiereSurvivors,setPremiereSurvivors]=useState<string[]>([]);

 const pool=useMemo(()=>queens.filter(q=>q.franchiseCodes.some(c=>selectedFranchises.includes(c))),[queens,selectedFranchises]);
 const selectedSeason=seasons.find(s=>s.id===seasonId);
 const customCount=Math.max(4,Math.min(32,Number(config.customCount)||4));
 const desired=castMode==="BY_SEASON"&&selectedSeason?selectedSeason.cast_ids.length:config.queenCount==="CUSTOM"?customCount:Number(config.queenCount);
 const seasonCast:Queen[]=selectedSeason?selectedSeason.cast_ids.map((id:string)=>queens.find(q=>q.id===id)).filter((q):q is Queen=>Boolean(q)):[];
 const suggestions=queenSearch.trim()?pool.filter(q=>q.name.toLowerCase().includes(queenSearch.toLowerCase())||(q.aliases??[]).some(a=>a.toLowerCase().includes(queenSearch.toLowerCase()))).slice(0,12):[];
 const queenMap=useMemo(()=>new Map([...queens,...customQueens].map(q=>[q.id,q])),[queens,customQueens]);
 const currentCast=cast.length?cast:castMode==="BY_SEASON"?seasonCast:[...queens.filter(q=>selectedIds.includes(q.id)),...customQueens.filter(q=>selectedIds.includes(q.id))];
 const setSetting=(key:keyof typeof blankConfig,value:string|boolean)=>setConfig(old=>{
  if(key==="finaleFormat"){
   const defaults:Record<string,string>={TOP2:"2",TOP3:"3",TOP4:"4",POINTS:"3",LIPSYNC:"2"};
   return {...old,[key]:String(value),finalistCount:defaults[String(value)]??old.finalistCount};
  }
  return {...old,[key]:value};
 });
 function rankQueensForFinale(ids:string[],rows:SimEpisode[],format:string){
  const scoreMap=new Map(scoringRules.map(rule=>[rule.placement_key,Number(rule.score)]));
  return ids.map(id=>{
   const values=rows.map(ep=>ep.placements[id]).filter((placement):placement is Placement=>Boolean(placement)&&scoreMap.has(placement)).map(placement=>scoreMap.get(placement)??0);
   const ppe=values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0;
   const wins=rows.filter(ep=>ep.challengeWinnerId===id).length;
   return{id,ppe,wins};
  }).sort((a,b)=>format==="POINTS"?(b.ppe-a.ppe)||(b.wins-a.wins):(b.wins-a.wins)||(b.ppe-a.ppe)).map(row=>row.id);
 }

 function toggleQueen(id:string){setSelectedIds(old=>{if(old.includes(id))return old.filter(x=>x!==id);if(old.length>=desired)return old;return[...old,id];});}
 function randomCast(){const list=shuffle(pool).slice(0,desired);setCast(list);setSelectedIds(list.map(q=>q.id));}
 function randomizeCastOrder(){setCast(old=>shuffle(old));}
 function replaceCastQueen(oldId:string,newId:string){const replacement=queenMap.get(newId);if(!replacement||cast.some(q=>q.id===newId))return;setCast(old=>old.map(q=>q.id===oldId?replacement:q));setSelectedIds(old=>old.map(id=>id===oldId?newId:id));}
 function replaceCastQueenRandomly(oldId:string){const replacement=pick(pool.filter(q=>!cast.some(c=>c.id===q.id)));if(replacement)replaceCastQueen(oldId,replacement.id);}
 async function addCustomQueen(file?:File){
  const name=customName.trim();if(!name){setNotice("Inserisci il nome della Queen custom.");return;}
  if(selectedIds.length>=desired){setNotice("Hai già raggiunto il numero di Queen previsto.");return;}
  setUploading(true);setNotice("");
  try{
   let imageUrl=customImageUrl.trim()||null;let imagePath:string|null=null;
   if(file){
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024)throw new Error("Usa un'immagine JPG, PNG o WebP fino a 8 MB.");
    const ext=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
    imagePath=userId+"/drag-race-season/"+crypto.randomUUID()+"."+ext;
    const {error}=await db.storage.from("profile-media").upload(imagePath,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    const {data:signed,error:signedError}=await db.storage.from("profile-media").createSignedUrl(imagePath,60*60*24*7);
    if(signedError)throw signedError;imageUrl=signed?.signedUrl??null;
   }
   const queen:Queen={id:"custom-"+crypto.randomUUID(),name,aliases:[],image_url:imageUrl,image_path:imagePath,franchiseCodes:["CUSTOM"],custom:true};
   setCustomQueens(old=>[...old,queen]);setSelectedIds(old=>[...old,queen.id]);setCustomName("");setCustomImageUrl("");
  }catch(e){setNotice(e instanceof Error?e.message:"Impossibile aggiungere la Queen.");}
  finally{setUploading(false);}
 }
 function buildRandomRelationships(list:Queen[]){const pairs:Relationship[]=[];const shuffled=shuffle(list);for(let i=0;i<shuffled.length-1;i+=2){const a=shuffled[i],b=shuffled[i+1];pairs.push({id:a.id+"-"+b.id,a:a.id,b:b.id,type:pick(RELATIONS)??"Rivali",strength:Math.floor(Math.random()*41)-20,history:["Relazione iniziale"]});}return pairs;}
 function addRelationship(){if(!pairA||!pairB||pairA===pairB||relationships.some(r=>(r.a===pairA&&r.b===pairB)||(r.a===pairB&&r.b===pairA))){setNotice("Seleziona due Queen diverse e non già collegate.");return;}setRelationships(old=>[...old,{id:crypto.randomUUID(),a:pairA,b:pairB,type:pairType,strength:0,history:["Relazione iniziale"]}]);setPairA("");setPairB("");}
 function generateEpisode(number:number,active:string[]):SimEpisode{
  const live=active.map(id=>queenMap.get(id)).filter((q):q is Queen=>Boolean(q));const ranked=shuffle(live).map(q=>({q,score:Math.random()})).sort((a,b)=>b.score-a.score);
  const upsetPool=ranked.slice(Math.min(2,Math.max(0,ranked.length-1)));const challengeWinner=(config.challengeRiggory?pick(upsetPool)?.q.id:ranked[0]?.q.id)??active[0];
  const bottom=ranked.filter(x=>x.q.id!==challengeWinner).slice(-2).map(x=>x.q.id);
  const placements:Record<string,Placement>={};const episodeComments:Record<string,string>={};
  for(const q of live){placements[q.id]=q.id===challengeWinner?"WIN":bottom.includes(q.id)?"BTM2":"SAFE";episodeComments[q.id]=pick(comments)??comments[0];}
  const song=pick(songs);const lipsyncWinner=(config.lipsyncRiggory?bottom[0]:bottom[1])??bottom[0]??challengeWinner;
  const immunityId=config.immunity?(pick(live)?.id??null):null;
  const title=number===1&&config.premiereFormat==="SPLIT_2"?"Premiere · Parte 1":number===2&&config.premiereFormat==="SPLIT_2"?"Premiere · Parte 2":"Episodio "+number;
  const mini=config.miniMode==="NONE"||(config.miniMode==="RANDOM"&&Math.random()<0.5)?null:pick(MINI)??null;
  const miniChallengeWinnerId=mini?(pick(live)?.id??null):null;
  const outcome=number===1&&config.premiereFormat==="NO_ELIMINATION"?"NO_ELIMINATION":"ELIMINATION";
  const challenge=number===1&&config.premiereFormat==="RUMIX"?"Talent show":pick(CHALLENGES)??CHALLENGES[0];
  return{number,title,challenge,miniChallenge:mini,miniChallengeWinnerId,narrative:"Le Queen entrano nel Werk Room e affrontano una nuova prova. Le alleanze vengono messe alla prova, mentre la passerella cambia gli equilibri della competizione.",judgeFormat:config.judgeFormat,eliminatedId:bottom.find(id=>id!==lipsyncWinner)??bottom[0]??null,placements,comments:episodeComments,challengeWinnerId:challengeWinner??active[0],bottomIds:bottom,songId:song?.id??null,lipsyncWinnerId:lipsyncWinner??bottom[0]??null,immuneId:immunityId,goldenBeaverSaveId:null,outcome,eliminatedIds:[],untucked:Boolean(config.untucked),completed:false};
 }
 function updateCurrent<K extends keyof SimEpisode>(key:K,value:SimEpisode[K]){setCurrentEpisode(old=>{if(!old)return old;const next={...old,[key]:value} as SimEpisode;if(key==="lipsyncWinnerId")next.eliminatedId=old.bottomIds.find(id=>id!==String(value))??old.bottomIds[0]??null;if(key==="goldenBeaverSaveId"&&value)next.eliminatedId=old.bottomIds.find(id=>id!==String(value)&&id!==old.lipsyncWinnerId)??old.eliminatedId;return next;});}
 function updatePlacement(id:string,value:Placement){setCurrentEpisode(old=>{if(!old)return old;let bottomIds=[...old.bottomIds];if(value==="BTM2"){bottomIds=[...bottomIds.filter(x=>x!==id),id].slice(-2);}else if(bottomIds.includes(id)){bottomIds=bottomIds.filter(x=>x!==id);const replacement=activeIds.find(x=>x!==id&&!bottomIds.includes(x)&&x!==old.challengeWinnerId);if(replacement)bottomIds.push(replacement);}const challengeWinnerId=value==="WIN"?id:old.challengeWinnerId;const lipsyncWinnerId=bottomIds.includes(old.lipsyncWinnerId??"")?old.lipsyncWinnerId:bottomIds[0]??null;return{...old,placements:{...old.placements,[id]:value},bottomIds,challengeWinnerId,lipsyncWinnerId,eliminatedId:bottomIds.find(x=>x!==lipsyncWinnerId)??bottomIds[0]??null};});}
 function updateComment(id:string,value:string){setCurrentEpisode(old=>old?({...old,comments:{...old.comments,[id]:value}}):old);}
 function updateRelationshipEvents(ep:SimEpisode,eliminated:string[]){return relationships.map(rel=>{const bothBottom=ep.bottomIds.includes(rel.a)&&ep.bottomIds.includes(rel.b);const winnerInPair=ep.challengeWinnerId===rel.a||ep.challengeWinnerId===rel.b;const eliminationInPair=eliminated.includes(rel.a)||eliminated.includes(rel.b);const delta=bothBottom?-12:winnerInPair?8:eliminationInPair?5:0;return{...rel,strength:Math.max(-100,Math.min(100,rel.strength+delta)),history:delta?[...rel.history,"Episodio "+ep.number+": "+(bothBottom?"conflitto":winnerInPair?"successo condiviso":"eliminazione")]:rel.history};});}
 async function persistActive(nextEpisodes:SimEpisode[],nextActive:string[],nextEliminated:string[],nextRelationships:Relationship[]){
  if(!sessionId)return;
  const state={config,cast:currentCast,episodes:nextEpisodes,activeIds:nextActive,eliminatedIds:nextEliminated,relationships:nextRelationships,episodeNumber,finalists};
  const {error}=await db.rpc("drag_race_update_session",{p_session_id:sessionId,p_state:state,p_status:"ACTIVE",p_summary:null});
  if(error)setNotice("La stagione continua, ma il salvataggio temporaneo non è riuscito.");
 }
 async function beginSeason(){
  const chosen=castMode==="BY_SEASON"?seasonCast:castMode==="RANDOM"?cast:currentCast;
  if(chosen.length!==desired){setNotice("Completa il cast: servono "+desired+" Queen.");return;}
  if(new Set(chosen.map(q=>q.id)).size!==chosen.length){setNotice("Il cast non può contenere Queen duplicate.");return;}
  if(config.chocolateBar&&config.chocolateMode==="MANUAL"&&!config.chocolateQueenId){setNotice("Scegli la Queen che riceverà la Chocolate Bar.");return;}
  setBusy(true);setNotice("");
  const chocolateQueenId=config.chocolateBar&&config.chocolateMode==="RANDOM"?(pick(chosen)?.id??""):config.chocolateQueenId;
  if(chocolateQueenId!==config.chocolateQueenId)setConfig(old=>({...old,chocolateQueenId}));
  if(config.chocolateBar&&config.chocolateMode==="MANUAL"&&!chosen.some(q=>q.id===chocolateQueenId)){setNotice("La Queen scelta per la Chocolate Bar deve appartenere al cast.");setBusy(false);return;}
  const configSnapshot={...config,chocolateQueenId,queenCount:desired,franchises:selectedFranchises,castMode,sourceSeasonId:castMode==="BY_SEASON"?seasonId:null};
  const shuffledCast=config.premiereFormat==="SPLIT_2"?shuffle(chosen):chosen;
  const groupOne=config.premiereFormat==="SPLIT_2"?shuffledCast.slice(0,Math.ceil(shuffledCast.length/2)):shuffledCast;
  const groupTwo=config.premiereFormat==="SPLIT_2"?shuffledCast.slice(Math.ceil(shuffledCast.length/2)):[];
  const initialActive=groupOne.map(q=>q.id);
  const state={stage:"EPISODES",cast:chosen,activeIds:initialActive,premiereGroupTwo:groupTwo.map(q=>q.id),premiereSurvivors:[],eliminatedIds:[],episodes:[],relationships,returningUsed:false};
  const {data,error}=await db.rpc("drag_race_create_session",{p_mode:"SEASON_SIMULATOR",p_config:configSnapshot,p_state:state});
  if(error){setNotice("Impossibile avviare la stagione: "+error.message);setBusy(false);return;}
  setCast(chosen);setActiveIds(initialActive);setPremiereGroupTwo(groupTwo.map(q=>q.id));setPremiereSurvivors([]);setEliminatedIds([]);setEpisodes([]);setEpisodeNumber(1);setSessionId(String(data));setReturningUsed(false);setChocolateUsed(false);setFameScores({});setStage("episodes");setCurrentEpisode(null);setBusy(false);
 }
 function prepareEpisode(){if(!activeIds.length){setNotice("Non ci sono Queen attive.");return;}setCurrentEpisode(generateEpisode(episodeNumber,activeIds));}
 async function completeEpisode(){
  if(!currentEpisode)return;
  let out=currentEpisode.outcome;let removed:string[]=[];
  if(out==="DOUBLE_SHANTAY"&&!config.doubleShantay)out="ELIMINATION";
  if(out==="DOUBLE_SASHAY"&&!config.doubleSashay)out="ELIMINATION";
  const loser=currentEpisode.eliminatedId??currentEpisode.bottomIds.find(id=>id!==currentEpisode.lipsyncWinnerId)??currentEpisode.bottomIds[1]??currentEpisode.bottomIds[0];
  if(out==="NO_ELIMINATION"||out==="DOUBLE_SHANTAY")removed=[];
  else if(out==="DOUBLE_SASHAY")removed=[...currentEpisode.bottomIds];
  else if(out==="ELIMINATION"&&loser)removed=[loser];
  if(config.goldenBeaver&&currentEpisode.goldenBeaverSaveId)removed=removed.filter(id=>id!==currentEpisode.goldenBeaverSaveId);
  if(currentEpisode.immuneId)removed=removed.filter(id=>id!==currentEpisode.immuneId);
  if(config.chocolateBar&&removed.includes(config.chocolateQueenId)&&!chocolateUsed){
   const result=config.chocolateMode==="RANDOM"?(Math.random()<0.18?"CHOCOLATE":"EMPTY"):"CHOCOLATE";
   if(result==="CHOCOLATE"){removed=removed.filter(id=>id!==config.chocolateQueenId);setNotice((queenMap.get(config.chocolateQueenId)?.name??"La Queen")+" ha trovato la Chocolate Bar e resta in gara.");}
   else setNotice("La Chocolate Bar è vuota: eliminazione confermata.");
   setChocolateUsed(true);
  }
  const episode={...currentEpisode,placements:{...currentEpisode.placements,...Object.fromEntries(removed.map(id=>[id,"ELIM" as Placement]))},outcome:out,eliminatedIds:removed,completed:true};
  const nextEpisodes=[...episodes,episode];const nextEliminated=[...eliminatedIds,...removed];let nextActive=activeIds.filter(id=>!removed.includes(id));
  const splitTransition=config.premiereFormat==="SPLIT_2"&&episodeNumber===1;
  if(splitTransition){setPremiereSurvivors(nextActive);nextActive=premiereGroupTwo;}
  else if(config.premiereFormat==="SPLIT_2"&&episodeNumber===2){nextActive=[...premiereSurvivors,...nextActive];setPremiereGroupTwo([]);setPremiereSurvivors([]);}
  const nextRelationships=updateRelationshipEvents(episode,removed);
  const nextFame={...fameScores};if(config.fameGames)for(const [id,placement] of Object.entries(episode.placements)){const points=placement==="WIN"?3:placement==="HIGH"?2:placement==="SAFE"?1:placement==="BTM2"?-1:0;nextFame[id]=(nextFame[id]??0)+points;}
  setEpisodes(nextEpisodes);setEliminatedIds(nextEliminated);setActiveIds(nextActive);setRelationships(nextRelationships);setFameScores(nextFame);setCurrentEpisode(null);
  await persistActive(nextEpisodes,nextActive,nextEliminated,nextRelationships);
  if(splitTransition){setEpisodeNumber(2);return;}
  const finalCount=Math.max(2,Math.min(4,Number(config.finalistCount)||3));
  if(nextActive.length<=finalCount||episodeNumber>=Math.max(4,Math.min(20,Number(config.episodeCount)||10))){
   const ranked=rankQueensForFinale(nextActive,nextEpisodes,config.finaleFormat);
   const chosenFinalists=(ranked.length?ranked:activeIds).slice(0,Math.max(2,Math.min(finalCount,ranked.length||activeIds.length)));
   const finalOrder=config.finaleFormat==="POINTS"?chosenFinalists:shuffle(chosenFinalists);
   setFinalists(chosenFinalists);setWinnerId(finalOrder[0]??"");setRunnerUpId(finalOrder[1]??"");setThirdId(finalOrder[2]??"");
   if(config.finaleFormat==="TOP2"||config.finaleFormat==="LIPSYNC")setFinaleSongId(pick(songs)?.id??"");
   setStage("finale");
  }else{setEpisodeNumber(n=>n+1);}
 }
 function chooseFinalists(ids:string[],countOverride?:number){
  const count=Math.max(2,Math.min(4,countOverride??(Number(config.finalistCount)||3)));
  const ordered=rankQueensForFinale(ids,episodes,config.finaleFormat).slice(0,count);
  setFinalists(ordered);setConfig(old=>({...old,finalistCount:String(count)}));
  setWinnerId(ordered[0]??"");setRunnerUpId(ordered[1]??"");setThirdId(ordered[2]??"");
 }
 function createTrackRecord(){
  const base={episodes:episodes.map(ep=>({number:ep.number,title:ep.title,counts_for_ppe:true,mini_challenge:ep.miniChallenge,maxi_challenge:ep.challenge})),queens:cast.map(q=>({id:q.id,name:q.name,image_url:q.image_url,winner:q.id===winnerId,results:episodes.map(ep=>({episode:ep.number,placement:ep.placements[q.id]??(ep.eliminatedIds.includes(q.id)?"ELIM":null)})),ppe_episode_numbers:episodes.map(ep=>ep.number)}))};
  return sortTrackRecordQueens(base,scoringRules).map(q=>{const id=q.id??"";return{...q,id,final_placement:id===winnerId?"WINNER":id===runnerUpId?"RUNNER_UP":id===thirdId?"THIRD":eliminatedIds.includes(id)?"ELIMINATED":"FINALIST"};});
 }
 function computeStatistics(trackRecord:ReturnType<typeof createTrackRecord>){
  return cast.map(q=>{const results=episodes.map(ep=>ep.placements[q.id]).filter(Boolean);const track=trackRecord.find(row=>row.id===q.id);return{queenId:q.id,queenName:q.name,challengeWins:episodes.filter(ep=>ep.challengeWinnerId===q.id).length,lipsyncWins:episodes.filter(ep=>ep.lipsyncWinnerId===q.id).length,bottom2:episodes.filter(ep=>ep.bottomIds.includes(q.id)).length,eliminations:episodes.filter(ep=>ep.eliminatedIds.includes(q.id)).length,placements:results,ppe:track?.ppe??null,calculatedRank:track?.calculated_rank??null};});
 }
 async function saveSeason(){
  if(!sessionId||!winnerId){setNotice("Seleziona la vincitrice prima di salvare.");return;}
  setBusy(true);setNotice("");
  const trackRecord=createTrackRecord();
  const record={config,franchiseCodes:selectedFranchises,cast,episodes,finale:{finalists,winnerId,runnerUpId,thirdId,format:config.finaleFormat,songId:finaleSongId},relationships,trackRecord,fameGames:config.fameGames?fameScores:null,createdAt:new Date().toISOString()};
  const stats={winnerId,runnerUpId,thirdId,episodes:episodes.length,queenCount:cast.length,queenStatistics:computeStatistics(trackRecord),fameGamesWinner:config.fameGames?Object.entries(fameScores).sort((a,b)=>b[1]-a[1])[0]?.[0]??null:null};
  const seasonTitle=title.trim()||("Drag Race · "+cast.length+" Queen · "+new Date().toLocaleDateString("it-IT"));
  const summary={completed:1,wins:1,losses:0,percentage:100,winnerId,runnerUpId,thirdId,finaleSongId,episodes:episodes.length,queenCount:cast.length};
  const state={stage:"COMPLETED",winnerId,runnerUpId,thirdId,episodes:episodes.length,queenCount:cast.length};
  const {data:savedSeasonId,error}=await db.rpc("drag_race_save_season",{p_session_id:sessionId,p_title:seasonTitle,p_season_data:record,p_statistics:stats,p_state:state,p_summary:summary});
  if(error||!savedSeasonId){setNotice("Salvataggio non riuscito: "+(error?.message??"Risposta non valida dal server."));setBusy(false);return;}
  setSavedId(savedSeasonId);setBusy(false);setStage("saved");
 }
 async function abandonSeason(){
  if(!sessionId||!window.confirm("Abbandonare la stagione? Non verrà salvata."))return;
  const state={stage:"ABANDONED",episodes,activeIds,eliminatedIds};
  await db.rpc("drag_race_update_session",{p_session_id:sessionId,p_state:state,p_status:"ABANDONED",p_summary:{abandoned:true,episodes:episodes.length}});
  setStage("setup");setSessionId(null);setCurrentEpisode(null);setNotice("Stagione abbandonata. Nessun risultato è stato salvato.");
 }
 function startFinale(){
  const list=finalists.length?finalists:rankQueensForFinale(activeIds,episodes,config.finaleFormat).slice(0,Math.max(2,Math.min(4,Number(config.finalistCount)||3)));
  setFinalists(list);
  const shuffled=shuffle(list);setWinnerId(shuffled[0]??"");setRunnerUpId(shuffled[1]??"");setThirdId(shuffled[2]??"");
  if((config.finaleFormat==="TOP2"||config.finaleFormat==="LIPSYNC")&&!finaleSongId)setFinaleSongId(pick(songs)?.id??"");
 }
 function renderQueen(q:Queen){return <div className="ss-queen-mini" key={q.id}>{q.image_url?(q.custom?<img src={q.image_url} alt=""/>:<QueenCatalogImage id={q.id} name={q.name} src={q.image_url} className="ss-queen-mini-image"/>):<span>{q.name.slice(0,1)}</span>}<strong>{q.name}</strong>{q.custom&&<small>Custom</small>}</div>;}
 const finaleSong=songs.find(song=>song.id===finaleSongId)??null;
 if(stage==="saved")return <main className="ss-page drag-race-pop-season-sim"><section className="ss-finish-card"><Crown size={38}/><span>STAGIONE SALVATA</span><h1>Herstory <em>made.</em></h1><p>La stagione è stata salvata in sola lettura. Non può essere ripresa o modificata.</p>{savedId&&<Link href={"/drag-race/season-simulator/saved/"+savedId}>Apri stagione salvata <ArrowRight size={16}/></Link>}<button onClick={()=>window.location.reload()}>Nuova stagione</button></section></main>;
 return <main className="ss-page drag-race-pop-season-sim">
  <Link className="drag-back" href="/drag-race"><ArrowLeft size={16}/> Drag Race</Link>
  <header className="ss-heading"><span>RENQD × DRAG RACE · SEASON SIMULATOR</span><h1>Make <em>herstory.</em></h1><p>Crea il cast, costruisci le relazioni e guida ogni episodio fino alla corona.</p></header>
  {savedSeasons.length>0&&stage==="setup"&&<section className="ss-saved-strip"><div><strong>Le tue stagioni</strong><small>Archivio personale · sola lettura</small></div><Link href="/drag-race/season-simulator/saved">Vedi archivio <ArrowRight size={15}/></Link></section>}
  {stage==="setup"&&<section className="ss-panel">
   <div className="ss-step-label">01 · CONFIGURAZIONE</div><h2>Imposta la tua stagione</h2>
   <div className="ss-grid">
    <label>Numero Queen<select value={config.queenCount} onChange={e=>setSetting("queenCount",e.target.value)}><option value="8">8 Queen</option><option value="10">10 Queen</option><option value="12">12 Queen</option><option value="14">14 Queen</option><option value="16">16 Queen</option><option value="CUSTOM">Personalizzato</option></select></label>
    {config.queenCount==="CUSTOM"&&<label>Numero personalizzato<input type="number" min="4" max="32" value={config.customCount} onChange={e=>setSetting("customCount",e.target.value)}/></label>}
    <label>Premiere format<select value={config.premiereFormat} onChange={e=>setSetting("premiereFormat",e.target.value)}><option value="STANDARD">Premiere standard</option><option value="SPLIT_2">Split premiere · 2 gruppi</option><option value="NO_ELIMINATION">Premiere senza eliminazione</option><option value="RUMIX">Premiere talent show</option></select></label>
    <label>Returning format<select value={config.returningFormat} onChange={e=>setSetting("returningFormat",e.target.value)}><option value="NONE">Nessun ritorno</option><option value="RETURNING">Una Queen ritorna</option><option value="LALAPARUZA">Lalaparuza di ritorno</option><option value="FAME_GAMES">Fame Games</option></select></label>
    <label>Season format<select value={config.seasonFormat} onChange={e=>setSetting("seasonFormat",e.target.value)}><option value="STANDARD">Regular season</option><option value="ALL_STARS">All Stars</option><option value="VS_THE_WORLD">Vs the World</option><option value="TOURNAMENT">Tournament</option><option value="CUSTOM">Custom format</option></select></label>
    <label>Finale format<select value={config.finaleFormat} onChange={e=>setSetting("finaleFormat",e.target.value)}><option value="TOP2">Top 2 · Lipsync for the crown</option><option value="TOP3">Top 3</option><option value="TOP4">Top 4</option><option value="POINTS">Finale a punti</option><option value="LIPSYNC">Lipsync finale</option></select></label>
    <label>Numero episodi<input type="number" min="4" max="20" value={config.episodeCount} onChange={e=>setSetting("episodeCount",e.target.value)}/></label>
    <label>Finalisti<input type="number" min="2" max="4" value={config.finalistCount} onChange={e=>setSetting("finalistCount",e.target.value)}/></label>
    <label>Mini challenge<select value={config.miniMode} onChange={e=>setSetting("miniMode",e.target.value)}><option value="EVERY_EPISODE">Ogni episodio</option><option value="RANDOM">Casuale</option><option value="NONE">Nessuna</option></select></label>
    <label>Formato giudizio<select value={config.judgeFormat} onChange={e=>setSetting("judgeFormat",e.target.value)}><option value="STANDARD">Giudizio standard</option><option value="CRITIQUES">Critiche individuali</option><option value="POSITIVITY">Positivo</option><option value="HARSH">Severo</option></select></label>
   </div>
   <h3>Twist e regole speciali</h3>
   <div className="ss-toggle-grid">
    {([["doubleShantay","Double Shantay"],["doubleSashay","Double Sashay"],["challengeRiggory","Challenge Riggory"],["lipsyncRiggory","Lipsync Riggory"],["immunity","Immunity"],["goldenBeaver","Golden Beaver"],["fameGames","Fame Games"],["chocolateBar","Chocolate Bar"],["untucked","Untucked"]] as const).map(([key,label])=><label key={key}><input type="checkbox" checked={Boolean(config[key])} onChange={e=>setSetting(key,e.target.checked)}/>{label}</label>)}
   </div>
   {config.chocolateBar&&<div className="ss-grid"><label>Chocolate Bar<select value={config.chocolateMode} onChange={e=>setSetting("chocolateMode",e.target.value)}><option value="RANDOM">Assegnazione casuale</option><option value="MANUAL">Scelgo la Queen</option></select></label></div>}
   <label className="ss-full">Altri twist configurabili<textarea value={config.otherTwists} onChange={e=>setSetting("otherTwists",e.target.value)} placeholder="Aggiungi regole o twist personalizzati…"/></label>
   <button className="ss-primary" onClick={()=>setStage("cast")}>Continua al cast <ArrowRight size={16}/></button>
  </section>}
  {stage==="cast"&&<section className="ss-panel">
   <div className="ss-step-label">02 · CAST</div><h2>Chi entra nel Werk Room?</h2>
   <div className="ss-mode-tabs">{(["RANDOM","CUSTOM","BY_SEASON"] as const).map(mode=><button key={mode} className={castMode===mode?"is-active":""} onClick={()=>{setCastMode(mode);setCast([]);setSelectedIds([]);}}>{mode==="RANDOM"?"Random":mode==="CUSTOM"?"Custom":"Da una stagione"}</button>)}</div>
   {castMode==="RANDOM"&&<><p>Estrazione da tutti i franchise selezionati, senza Queen duplicate.</p><FranchisePicker franchises={franchises} selected={selectedFranchises} onChange={setSelectedFranchises} mode="multiple"/><button className="ss-secondary" onClick={randomCast}><Shuffle size={15}/> Estrai {desired} Queen</button></>}
   {castMode==="CUSTOM"&&<><p>Seleziona Queen dal catalogo e aggiungi eventuali Queen custom. Il cast sarà bloccato quando inizierà la stagione.</p><input className="ss-search" value={queenSearch} onChange={e=>setQueenSearch(e.target.value)} placeholder="Cerca Queen o alias…"/><div className="ss-suggestions">{suggestions.map(q=><button key={q.id} onClick={()=>toggleQueen(q.id)}><QueenCatalogImage id={q.id} name={q.name} src={q.image_url} className="ss-queen-suggestion-image"/><span>{selectedIds.includes(q.id)?"✓ ":"＋ "}{q.name}</span></button>)}</div><div className="ss-custom-form"><input value={customName} onChange={e=>setCustomName(e.target.value)} placeholder="Nome Queen custom"/><input value={customImageUrl} onChange={e=>setCustomImageUrl(e.target.value)} placeholder="URL immagine (facoltativo)"/><label className="ss-upload"><Upload size={15}/> Carica immagine<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>void addCustomQueen(e.target.files?.[0])}/></label><button disabled={uploading} onClick={()=>void addCustomQueen()}>{uploading?<LoaderCircle size={15}/>:<Plus size={15}/>} Aggiungi Queen</button></div><p>{selectedIds.length}/{desired} selezionate</p></>}
   {castMode==="BY_SEASON"&&<><div className="ss-season-franchise"><FranchisePicker franchises={franchises} selected={selectedFranchises.slice(0,1)} onChange={next=>{setSelectedFranchises(next);setSeasonId("");}} mode="single"/></div><div className="ss-grid"><label>Stagione<select value={seasonId} onChange={e=>setSeasonId(e.target.value)}><option value="">Seleziona stagione</option>{seasons.filter(s=>s.franchise_code===selectedFranchises[0]).map(s=><option key={s.id} value={s.id}>{s.name} · {s.year??"Anno n/d"}</option>)}</select></label></div><p>Il cast importato da una stagione ufficiale non può essere modificato.</p></>}
   <div className="ss-cast-preview">{(castMode==="BY_SEASON"?seasonCast:castMode==="RANDOM"?cast:[...queens.filter(q=>selectedIds.includes(q.id)),...customQueens.filter(q=>selectedIds.includes(q.id))]).map(renderQueen)}</div>
    {config.chocolateBar&&config.chocolateMode==="MANUAL"&&<label className="ss-full">Queen con Chocolate Bar<select value={config.chocolateQueenId} onChange={e=>setSetting("chocolateQueenId",e.target.value)}><option value="">Seleziona Queen del cast</option>{currentCast.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}</select></label>}
   {castMode==="RANDOM"&&cast.length>0&&<div className="ss-cast-tools"><button onClick={randomizeCastOrder}><Shuffle size={14}/> Randomize ordine</button><button onClick={()=>{const q=pick(cast);if(q)replaceCastQueenRandomly(q.id);}}><RefreshCw size={14}/> Sostituzione casuale</button><label>Sostituisci Queen<select defaultValue="" onChange={e=>{const [oldId,newId]=e.target.value.split("|");if(oldId&&newId)replaceCastQueen(oldId,newId);}}><option value="">Scegli sostituzione</option>{cast.map(q=><optgroup key={q.id} label={"Rimuovi "+q.name}>{pool.filter(p=>!cast.some(c=>c.id===p.id)).map(p=><option key={p.id} value={q.id+"|"+p.id}>{p.name}</option>)}</optgroup>)}</select></label></div>}
   <div className="ss-actions"><button className="ss-secondary" onClick={()=>setStage("setup")}>Indietro</button><button className="ss-primary" onClick={()=>{const chosen=castMode==="BY_SEASON"?seasonCast:castMode==="RANDOM"?cast:[...queens.filter(q=>selectedIds.includes(q.id)),...customQueens.filter(q=>selectedIds.includes(q.id))];if(chosen.length!==desired){setNotice("Seleziona esattamente "+desired+" Queen.");return;}setCast(chosen);setStage("relationships");setNotice("");}}>Continua <ArrowRight size={16}/></button></div>
  </section>}
  {stage==="relationships"&&<section className="ss-panel">
   <div className="ss-step-label">03 · RELAZIONI</div><h2>Le dinamiche tra Queen</h2><p>Le relazioni possono nascere casualmente o essere impostate manualmente. Si evolvono durante gli episodi in base a vittorie, conflitti e salvataggi.</p>
   <div className="ss-mode-tabs"><button className={relationshipMode==="RANDOM"?"is-active":""} onClick={()=>{setRelationshipMode("RANDOM");setRelationships(buildRandomRelationships(cast));}}>Casuali</button><button className={relationshipMode==="MANUAL"?"is-active":""} onClick={()=>setRelationshipMode("MANUAL")}>Manuali</button></div>
   {relationshipMode==="MANUAL"&&<div className="ss-grid"><label>Prima Queen<select value={pairA} onChange={e=>setPairA(e.target.value)}><option value="">Seleziona</option>{cast.map(q=><option key={q.id} value={q.id}>{q.name}</option>)}</select></label><label>Seconda Queen<select value={pairB} onChange={e=>setPairB(e.target.value)}><option value="">Seleziona</option>{cast.filter(q=>q.id!==pairA).map(q=><option key={q.id} value={q.id}>{q.name}</option>)}</select></label><label>Relazione<select value={pairType} onChange={e=>setPairType(e.target.value)}>{RELATIONS.map(r=><option key={r}>{r}</option>)}</select></label><button className="ss-secondary" onClick={addRelationship}><Plus size={15}/> Aggiungi relazione</button></div>}
   <div className="ss-relationship-list">{relationships.map(r=><div key={r.id}><strong>{queenMap.get(r.a)?.name} ↔ {queenMap.get(r.b)?.name}</strong><span>{r.type}</span><small>Intensità {r.strength}</small><button aria-label="Rimuovi relazione" onClick={()=>setRelationships(old=>old.filter(x=>x.id!==r.id))}><Trash2 size={14}/></button></div>)}</div>
   <div className="ss-actions"><button className="ss-secondary" onClick={()=>setStage("cast")}>Indietro</button><button className="ss-primary" disabled={busy} onClick={()=>void beginSeason()}>{busy?<LoaderCircle size={16}/>:<Crown size={16}/>} Avvia la stagione</button></div>
  </section>}
  {stage==="episodes"&&<section className="ss-panel">
   <div className="ss-step-label">04 · EPISODIO {episodeNumber}</div><h2>{currentEpisode?.title??"La gara continua"}</h2>
   <div className="ss-live-stats"><span>{activeIds.length} Queen attive</span><span>{eliminatedIds.length} eliminate</span><span>{episodes.length} episodi completati</span></div>
   {!currentEpisode?<><p>Genera la prossima puntata: challenge, giudizi, bottom e lipsync verranno proposti automaticamente e resteranno modificabili.</p><button className="ss-primary" onClick={prepareEpisode}><Shuffle size={15}/> Genera episodio {episodeNumber}</button></>:<>
    <div className="ss-grid"><label>Titolo episodio<input value={currentEpisode.title} onChange={e=>updateCurrent("title",e.target.value)}/></label><label>Maxi Challenge<select value={currentEpisode.challenge} onChange={e=>updateCurrent("challenge",e.target.value)}>{CHALLENGES.map(c=><option key={c}>{c}</option>)}</select></label><label>Mini Challenge<input value={currentEpisode.miniChallenge??""} onChange={e=>updateCurrent("miniChallenge",e.target.value||null)} placeholder="Nessuna"/></label>{currentEpisode.miniChallenge&&<label>Vincitrice Mini Challenge<select value={currentEpisode.miniChallengeWinnerId??""} onChange={e=>updateCurrent("miniChallengeWinnerId",e.target.value||null)}><option value="">Seleziona</option>{activeIds.map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select></label>}<label>Formato giudizio<select value={currentEpisode.judgeFormat} onChange={e=>updateCurrent("judgeFormat",e.target.value)}><option value="STANDARD">Standard</option><option value="CRITIQUES">Critiche individuali</option><option value="POSITIVITY">Positivo</option><option value="HARSH">Severo</option></select></label><label>Vincitrice Maxi Challenge<select value={currentEpisode.challengeWinnerId} onChange={e=>updateCurrent("challengeWinnerId",e.target.value)}>{activeIds.map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select></label></div>
    <label className="ss-full">Narrazione episodio<textarea value={currentEpisode.narrative} onChange={e=>updateCurrent("narrative",e.target.value)}/></label>
    <h3>Giudizi e piazzamenti</h3><div className="ss-judging">{activeIds.map(id=><div key={id}><strong>{queenMap.get(id)?.name}</strong><select value={currentEpisode.placements[id]??"SAFE"} onChange={e=>updatePlacement(id,e.target.value as Placement)}>{PLACEMENTS.filter(p=>p!=="ELIM").map(p=><option key={p}>{p}</option>)}</select><textarea value={currentEpisode.comments[id]??""} onChange={e=>updateComment(id,e.target.value)} aria-label={"Commento giudici "+queenMap.get(id)?.name}/></div>)}</div>
    <div className="ss-grid"><label>Brano lipsync<select value={currentEpisode.songId??""} onChange={e=>updateCurrent("songId",e.target.value||null)}><option value="">Nessun brano catalogato</option>{songs.map(s=><option key={s.id} value={s.id}>{s.song_title} · {s.song_artist??"Artista n/d"}</option>)}</select></label><label>Vincitrice lipsync<select value={currentEpisode.lipsyncWinnerId??""} onChange={e=>updateCurrent("lipsyncWinnerId",e.target.value||null)}>{currentEpisode.bottomIds.map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select></label><label>Queen eliminata<select value={currentEpisode.eliminatedId??""} onChange={e=>updateCurrent("eliminatedId",e.target.value||null)}><option value="">Nessuna</option>{currentEpisode.bottomIds.map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select></label><label>Esito<select value={currentEpisode.outcome} onChange={e=>updateCurrent("outcome",e.target.value as SimEpisode["outcome"])}><option value="ELIMINATION">Eliminazione</option>{currentEpisode.number===1&&config.premiereFormat==="NO_ELIMINATION"&&<option value="NO_ELIMINATION">Nessuna eliminazione</option>}{config.doubleShantay&&<option value="DOUBLE_SHANTAY">Double Shantay</option>}{config.doubleSashay&&<option value="DOUBLE_SASHAY">Double Sashay</option>}</select></label><label>Immunità<select value={currentEpisode.immuneId??""} onChange={e=>updateCurrent("immuneId",e.target.value||null)}><option value="">Nessuna</option>{activeIds.map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select></label>{config.goldenBeaver&&<label>Golden Beaver · Queen salvata<select value={currentEpisode.goldenBeaverSaveId??""} onChange={e=>updateCurrent("goldenBeaverSaveId",e.target.value||null)}><option value="">Nessuna</option>{currentEpisode.bottomIds.map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select></label>}</div>
    {currentEpisode.songId&&songs.find(s=>s.id===currentEpisode.songId)?.preview_url&&<audio className="ss-audio" controls src={songs.find(s=>s.id===currentEpisode.songId)?.preview_url??undefined}/>}
    {currentEpisode.untucked&&<div className="ss-untucked"><strong>Untucked</strong><p>Le Queen discutono delle critiche e delle strategie. Le relazioni si aggiorneranno al termine dell&apos;episodio.</p></div>}
    <div className="ss-actions"><button className="ss-secondary" onClick={()=>setCurrentEpisode(null)}>Rigenera episodio</button><button className="ss-primary" onClick={()=>void completeEpisode()}><Check size={15}/> Conferma episodio</button></div>
   </>}
   {config.returningFormat!=="NONE"&&eliminatedIds.length>0&&!returningUsed&&episodes.length>=4&&<div className="ss-returning"><strong>Twist · Returning Queen</strong><p>Una Queen eliminata può rientrare nella competizione.</p><select id="ss-returning-select" defaultValue=""><option value="">Scegli Queen</option>{eliminatedIds.map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select><button onClick={()=>{const el=document.getElementById("ss-returning-select") as HTMLSelectElement|null;const id=el?.value;if(!id)return;setActiveIds(old=>[...old,id]);setEliminatedIds(old=>old.filter(x=>x!==id));setReturningUsed(true);setNotice((queenMap.get(id)?.name??"La Queen")+" è tornata in gara.");}}>Fai rientrare</button></div>}
   <div className="ss-eliminated"><strong>Queen eliminate</strong>{eliminatedIds.map(id=><span key={id}>{queenMap.get(id)?.name}</span>)}</div>
   <div className="ss-actions"><button className="ss-danger" onClick={()=>void abandonSeason()}>Abbandona senza salvare</button></div>
  </section>}
  {stage==="finale"&&<section className="ss-panel">
   <div className="ss-step-label">05 · GRAN FINALE</div><h2>Eleggi la tua vincitrice</h2><p>Formato: <strong>{({TOP2:"Top 2 · Lipsync for the crown",TOP3:"Top 3",TOP4:"Top 4",POINTS:"Finale a punti",LIPSYNC:"Lipsync finale"} as Record<string,string>)[config.finaleFormat]??config.finaleFormat}</strong>. Numero di finaliste e posizioni restano modificabili.</p>
   <label>Numero finaliste<select value={String(finalists.length||config.finalistCount)} onChange={e=>chooseFinalists(activeIds,Number(e.target.value))}><option value="2">Top 2</option><option value="3">Top 3</option><option value="4">Top 4</option></select></label>
   <div className="ss-finalists">{finalists.map(id=>{const q=queenMap.get(id);return q?<button key={id} className={winnerId===id?"is-winner":""} onClick={()=>setWinnerId(id)}>{q.image_url?<img src={q.image_url} alt=""/>:<span>{q.name.slice(0,1)}</span>}<strong>{q.name}</strong>{winnerId===id&&<Crown size={16}/>}</button>:null;})}</div>
   {(config.finaleFormat==="TOP2"||config.finaleFormat==="LIPSYNC")&&<div className="ss-finale-song"><label>Brano della finale<select value={finaleSongId} onChange={e=>setFinaleSongId(e.target.value)}><option value="">Seleziona un brano</option>{songs.map(song=><option key={song.id} value={song.id}>{song.song_title}{song.song_artist?" · "+song.song_artist:""}</option>)}</select></label>{finaleSong?.preview_url?<audio controls preload="none" src={finaleSong.preview_url}/>:<small>Anteprima audio non disponibile per il brano selezionato.</small>}{finaleSong?.apple_music_url&&<a href={finaleSong.apple_music_url} target="_blank" rel="noreferrer">Apri su Apple Music</a>}<button type="button" className="ss-secondary" onClick={()=>setFinaleSongId(pick(songs)?.id??"")}>Estrai un altro brano</button></div>}
   <div className="ss-grid"><label>Vincitrice<select value={winnerId} onChange={e=>setWinnerId(e.target.value)}><option value="">Seleziona</option>{finalists.map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select></label><label>Runner-up<select value={runnerUpId} onChange={e=>setRunnerUpId(e.target.value)}><option value="">Seleziona</option>{finalists.filter(id=>id!==winnerId).map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select></label><label>Terzo posto<select value={thirdId} onChange={e=>setThirdId(e.target.value)}><option value="">Nessuno</option>{finalists.filter(id=>id!==winnerId&&id!==runnerUpId).map(id=><option key={id} value={id}>{queenMap.get(id)?.name}</option>)}</select></label></div>
   <button className="ss-secondary" onClick={startFinale}><Shuffle size={15}/> Estrai ordine finale</button>
   <label className="ss-full">Titolo stagione<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Es. RuPaul's Drag Race · Season 1"/></label>
   <div className="ss-actions"><button className="ss-secondary" onClick={()=>setStage("episodes")}>Torna agli episodi</button><button className="ss-primary" disabled={!winnerId||busy} onClick={()=>void saveSeason()}>{busy?<LoaderCircle size={15}/>:<Save size={15}/>} Salva stagione</button></div>
   <p className="ss-readonly-note">Il salvataggio è manuale. Dopo il salvataggio la stagione sarà consultabile in sola lettura e non potrà essere ripresa.</p>
  </section>}
  {notice&&<p className="ss-notice" role="status">{notice}</p>}
 </main>;
}