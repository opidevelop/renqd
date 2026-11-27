const decodeHtml=(value)=>value
 .replace(/&nbsp;|&#160;/gi," ")
 .replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
 .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n)))
 .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));
const cellText=(html)=>decodeHtml(html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi," ").replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ")).trim();
const normalize=(value)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"").trim();
const episodeNumber=(value)=>{const text=value.trim().replace(/\[[^\]]*\]/g,"").trim();const match=text.match(/^(?:episode|ep\.?\s*)\s*(\d+)$/i)??text.match(/^(\d+)$/);return match?Number(match[1]):null;};
const songParts=(value)=>{const text=decodeHtml(value).replace(/\[[^\]]*\]/g," ").replace(/\s+/g," ").trim();if(!text)return null;let title=text,artist=null;const open=text.lastIndexOf("("),close=text.lastIndexOf(")");if(open>0&&close===text.length-1){const candidate=text.slice(open+1,close).trim();if(candidate){artist=candidate;title=text.slice(0,open).trim();}}title=title.replace(/^["“”'‘’\s]+|["“”'‘’\s]+$/g,"").trim();return title?{title,artist}:null;};
const resolveQueen=(value,queens,lookup)=>{const text=value.trim();if(!text||/^vs\.?$/i.test(text))return null;const candidates=[text,...[...text.matchAll(/\(([^)]+)\)/g)].map(x=>x[1].trim())];for(const candidate of candidates){const exact=lookup.get(normalize(candidate));if(exact)return exact;}for(const candidate of candidates){const key=normalize(candidate);if(key.length<3)continue;const matches=queens.filter(q=>[q.name,...(q.aliases??[])].some(name=>normalize(name).includes(key)||key.includes(normalize(name))));if(matches.length===1)return matches[0];}return null;};
export function parseLipsyncTables(html,episodes,queens){
 const knownEpisodes=new Set(episodes.map(x=>x.number)),lookup=new Map();
 for(const queen of queens)for(const name of [queen.name,...(queen.aliases??[])]){const key=normalize(name);if(key)lookup.set(key,lookup.has(key)&&lookup.get(key)?.id!==queen.id?null:queen);}
 const tables=[...html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)].filter(match=>/\bclass\s*=\s*["'][^"']*wikitable/i.test(match[1]??"")),found=[];
 for(const table of tables){
  const rows=[...(table[2]??"").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>[...(x[1]??"").matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map(cell=>cellText(cell[1]??"")));
  const headerIndex=rows.findIndex(row=>row.some(cell=>/song/i.test(cell))&&row.some(cell=>/contestant|queen|bottom|lip.?sync/i.test(cell)));
  if(headerIndex<0)continue;
  const header=rows[headerIndex],songColumn=header.findIndex(cell=>/song/i.test(cell)),episodeColumn=header.findIndex(cell=>/episode|round/i.test(cell)),contestantColumns=header.map((cell,index)=>({cell,index})).filter(x=>/contestant|queen|bottom|lip.?sync/i.test(x.cell)).map(x=>x.index);
  for(const row of rows.slice(headerIndex+1)){
   if(!row.length)continue;
   const episode=episodeNumber(row[episodeColumn>=0?episodeColumn:0]??"");if(episode===null||!knownEpisodes.has(episode))continue;
   let songIndex=row.findIndex((cell,index)=>index>0&&/["“]/.test(cell)&&/\([^()]+\)\s*$/.test(cell));
   if(songIndex<0&&songColumn>=0){const vsCount=row.filter(cell=>/^vs\.?$/i.test(cell.trim())).length;songIndex=songColumn+vsCount*2;if(songIndex>=row.length)songIndex=songColumn;}
   if(songIndex<0||songIndex>=row.length)continue;
   const song=songParts(row[songIndex]??"");if(!song)continue;
   const rawQueenCells=row.length===header.length&&contestantColumns.length?contestantColumns.map(index=>row[index]??""):row.slice(1,songIndex);
   const queenIds=[];
   for(const raw of rawQueenCells){if(!raw||/^vs\.?$/i.test(raw.trim()))continue;for(const piece of raw.split(/\s+(?:vs\.?|&|and)\s+/i).map(x=>x.trim()).filter(Boolean)){const queen=resolveQueen(piece,queens,lookup);if(queen&&!queenIds.includes(queen.id))queenIds.push(queen.id);}}
   if(queenIds.length===2)found.push({episode,songTitle:song.title,songArtist:song.artist,queenIds,rawRow:row});
  }
 }
 const unique=new Map();for(const item of found){const key=[item.episode,normalize(item.songTitle),...item.queenIds.slice().sort()].join("|");if(!unique.has(key))unique.set(key,item);}return [...unique.values()];
}