import type { NextRequest } from "next/server";
import type { CatalogEntity, CatalogItem } from "@/lib/catalog/types";

type TmdbImage = string | null | undefined;
type TmdbMovie = { id:number; title:string; original_title?:string; release_date?:string; poster_path?:TmdbImage; overview?:string };
type TmdbShow = { id:number; name:string; original_name?:string; first_air_date?:string; poster_path?:TmdbImage; overview?:string; created_by?:Array<{id:number;name:string;profile_path?:TmdbImage}> };
type TmdbPerson = { id:number; name:string; known_for_department?:string; profile_path?:TmdbImage; known_for?:Array<{title?:string;name?:string}> };
type TmdbCollection = { id:number; name:string; poster_path?:TmdbImage; parts?:TmdbMovie[] };
type TmdbCredits = { cast?:Array<TmdbMovie & {character?:string}>; crew?:Array<TmdbMovie & {job?:string;department?:string}> };

const API="https://api.themoviedb.org/3";
const IMAGE="https://image.tmdb.org/t/p/w500";
const LANGUAGE="it-IT";
function image(path:TmdbImage){return path?IMAGE+path:undefined;}
function year(date?:string){return date&&/^\d{4}/.test(date)?date.slice(0,4):"";}
function safeText(value:string){return value.trim().slice(0,100);}
async function tmdb<T>(path:string,params:Record<string,string>={}):Promise<T>{
 const token=process.env.TMDB_API_READ_ACCESS_TOKEN||process.env.TMDB_ACCESS_TOKEN;
 if(!token)throw new Error("TMDB_NOT_CONFIGURED");
 const url=new URL(API+path);
 for(const [key,value] of Object.entries({language:LANGUAGE,...params}))url.searchParams.set(key,value);
 const response=await fetch(url,{headers:{Accept:"application/json",Authorization:"Bearer "+token},next:{revalidate:3600}});
 if(!response.ok)throw new Error("TMDB returned "+response.status);
 return response.json() as Promise<T>;
}
function movieEntity(movie:TmdbMovie):CatalogEntity{return{id:String(movie.id),title:movie.title,subtitle:[year(movie.release_date),movie.original_title&&movie.original_title!==movie.title?movie.original_title:""].filter(Boolean).join(" · ")||"Film",imageUrl:image(movie.poster_path),provider:"tmdb",payload:{tmdbId:movie.id,mediaType:"movie"}};}
function showEntity(show:TmdbShow):CatalogEntity{return{id:String(show.id),title:show.name,subtitle:[year(show.first_air_date),show.original_name&&show.original_name!==show.name?show.original_name:""].filter(Boolean).join(" · ")||"Serie TV",imageUrl:image(show.poster_path),provider:"tmdb",payload:{tmdbId:show.id,mediaType:"tv"}};}
function personEntity(person:TmdbPerson,contentType:string):CatalogEntity{return{id:String(person.id),title:person.name,subtitle:[person.known_for_department,person.known_for?.slice(0,2).map(item=>item.title??item.name).filter(Boolean).join(", ")].filter(Boolean).join(" · ")||contentType,imageUrl:image(person.profile_path),provider:"tmdb",payload:{tmdbId:person.id,personName:person.name}};}
function collectionEntity(collection:TmdbCollection):CatalogEntity{return{id:String(collection.id),title:collection.name,subtitle:"Saga cinematografica",imageUrl:image(collection.poster_path??collection.parts?.[0]?.poster_path),provider:"tmdb",payload:{tmdbId:collection.id}};}
function movieItem(movie:TmdbMovie):Omit<CatalogItem,"selected"|"source">{return{id:String(movie.id),title:movie.title,subtitle:year(movie.release_date)||"Film",imageUrl:image(movie.poster_path),payload:{tmdbId:movie.id,mediaType:"movie"}};}
function showItem(show:TmdbShow):Omit<CatalogItem,"selected"|"source">{return{id:String(show.id),title:show.name,subtitle:year(show.first_air_date)||"Serie TV",imageUrl:image(show.poster_path),payload:{tmdbId:show.id,mediaType:"tv"}};}
async function searchMovies(query:string,page:number){const data=await tmdb<{results:TmdbMovie[];total_pages:number}>("/search/movie",{query,page:String(page),include_adult:"false",region:"IT"});return{entities:(data.results??[]).map(movieEntity),hasMore:page<data.total_pages,nextOffset:page+1};}
async function searchShows(query:string,page:number){const data=await tmdb<{results:TmdbShow[];total_pages:number}>("/search/tv",{query,page:String(page),include_adult:"false"});return{entities:(data.results??[]).map(showEntity),hasMore:page<data.total_pages,nextOffset:page+1};}
async function searchPeople(query:string,contentType:string,page:number){const data=await tmdb<{results:TmdbPerson[];total_pages:number}>("/search/person",{query,page:String(page),include_adult:"false"});return{entities:(data.results??[]).map(person=>personEntity(person,contentType)),hasMore:page<data.total_pages,nextOffset:page+1};}
async function searchCollections(query:string,page:number){const data=await tmdb<{results:TmdbCollection[];total_pages:number}>("/search/collection",{query,page:String(page)});return{entities:(data.results??[]).map(collectionEntity),hasMore:page<data.total_pages,nextOffset:page+1};}
async function searchEntities(query:string,contentType:string,page:number){
 if(contentType==="Film")return searchMovies(query,page);
 if(contentType==="Serie TV")return searchShows(query,page);
 if(contentType==="Saghe cinematografiche")return searchCollections(query,page);
 if(["Registi","Attori","Creatori"].includes(contentType))return searchPeople(query,contentType,page);
 throw new Error("Unsupported film and TV catalog type");
}
async function loadItems(payload:Record<string,unknown>,contentType:string){
 const id=Number(payload.tmdbId);
 if(!Number.isSafeInteger(id)||id<=0)throw new Error("Invalid TMDB identifier");
 if(contentType==="Saghe cinematografiche"){
  const data=await tmdb<TmdbCollection>("/collection/"+id);
  return(data.parts??[]).sort((a,b)=>(a.release_date??"").localeCompare(b.release_date??"")).map(movieItem);
 }
 if(contentType==="Registi"||contentType==="Attori"){
  const credits=await tmdb<TmdbCredits>("/person/"+id+"/movie_credits");
  const movies=contentType==="Registi"?(credits.crew??[]).filter(item=>item.job==="Director"):(credits.cast??[]);
  const unique=new Map<number,TmdbMovie>();for(const movie of movies)unique.set(movie.id,movie);
  return[...unique.values()].sort((a,b)=>(a.release_date??"").localeCompare(b.release_date??"")).map(movieItem);
 }
 if(contentType==="Creatori"){
  const credits=await tmdb<TmdbCredits>("/person/"+id+"/tv_credits");
  const shows=(credits.crew??[]).filter(item=>["Creator","Co-Creator","Series Creator"].includes(item.job??""));
  const unique=new Map<number,TmdbMovie>();for(const show of shows)unique.set(show.id,show);
  return[...unique.values()].sort((a,b)=>(a.release_date??"").localeCompare(b.release_date??"")).map(item=>({id:String(item.id),title:(item as TmdbShow).name??item.title,subtitle:year((item as TmdbShow).first_air_date??item.release_date)||"Serie TV",imageUrl:image(item.poster_path),payload:{tmdbId:item.id,mediaType:"tv"}}));
 }
 throw new Error("Unsupported TMDB catalog action");
}
export async function GET(request:NextRequest){
 const params=request.nextUrl.searchParams;
 const action=params.get("action");
 const contentType=params.get("contentType")??"";
 if(params.get("provider")!=="tmdb"||!["Film","Serie TV","Saghe cinematografiche","Registi","Attori","Creatori"].includes(contentType))return Response.json({error:"Unsupported film and TV catalog request."},{status:400});
 try{
  if(action==="search"){
   const query=safeText(params.get("query")??"");
   if(query.length<2)return Response.json({error:"La ricerca deve contenere almeno 2 caratteri."},{status:400});
   const page=Math.max(1,Math.min(500,Number(params.get("offset")??1)||1));
   const result=await searchEntities(query,contentType,page);
   return Response.json(result,{headers:{"Cache-Control":"private, max-age=300, stale-while-revalidate=600"}});
  }
  if(action==="items"){
   const raw=params.get("payload");
   if(!raw||raw.length>2000)return Response.json({error:"Catalog item payload is missing or invalid."},{status:400});
   const payload=JSON.parse(raw) as Record<string,unknown>;
   const items=await loadItems(payload,contentType);
   return Response.json({items},{headers:{"Cache-Control":"private, max-age=300, stale-while-revalidate=600"}});
  }
  return Response.json({error:"Unsupported catalog action."},{status:400});
 }catch(error){
  const message=error instanceof Error?error.message:"TMDB provider error";
  if(message==="TMDB_NOT_CONFIGURED")return Response.json({error:"Catalogo Film e Serie TV non configurato: aggiungi TMDB_API_READ_ACCESS_TOKEN su Vercel."},{status:503});
  const upstreamStatus=Number(message.match(/returned (\d{3})/)?.[1]??0);
  return Response.json({error:message},{status:upstreamStatus===429?503:502});
 }
}
