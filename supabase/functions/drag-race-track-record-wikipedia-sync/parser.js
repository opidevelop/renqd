const decodeHtml=(value)=>value
 .replace(/&nbsp;|&#160;/gi," ")
 .replace(/&amp;/gi,"&").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
 .replace(/&quot;/gi,'"').replace(/&apos;|&#39;/gi,"'")
 .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
 .replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
const cellText=(html)=>decodeHtml(html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi," ").replace(/<br\s*\/?>/gi," ").replace(/<[^>]*>/g," ").replace(/\s+/g," ")).trim();
const parseCells=(row)=>{
 const cells=[];
 const re=/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
 for(const match of row.matchAll(re)){
  const attrs=match[2]??"";
  const rowSpan=Math.max(1,Number(attrs.match(/\browspan\s*=\s*["']?(\d+)/i)?.[1]??1));
  const colSpan=Math.max(1,Number(attrs.match(/\bcolspan\s*=\s*["']?(\d+)/i)?.[1]??1));
  cells.push({text:cellText(match[3]??""),rowSpan,colSpan});
 }
 return cells;
};
const expandRows=(rows)=>{
 const grid=[];
 rows.forEach((row,rowIndex)=>{
  grid[rowIndex]??=[];
  let column=0;
  for(const cell of parseCells(row)){
   while(grid[rowIndex][column]!==undefined)column++;
   for(let r=0;r<cell.rowSpan;r++){
    grid[rowIndex+r]??=[];
    for(let col=0;col<cell.colSpan;col++)grid[rowIndex+r][column+col]=cell.text;
   }
   column+=cell.colSpan;
  }
 });
 return grid;
};
const episodeNumber=(value)=>{
 const text=value.trim();
 const match=text.match(/^(?:episode|ep\.?\s*)\s*(\d+)$/i)??text.match(/^(\d+)$/);
 return match?Number(match[1]):null;
};
const placementCode=(value)=>{
 const text=value.toUpperCase().replace(/\[[^\]]*\]/g,"").replace(/\s+/g," ").trim();
 if(/^TOP2\b/.test(text))return "TOP2";
 if(/^HIGH\s+TEAM\b/.test(text))return "HIGH TEAM";
 if(/^HIGH\b/.test(text))return "HIGH";
 if(/^WIN\b/.test(text))return "WIN";
 if(/^SAFE\b/.test(text))return "SAFE";
 if(/^LOW\b/.test(text))return "LOW";
 if(/^BTM2\b/.test(text))return "BTM2";
 if(/^BTM\b/.test(text))return "BTM";
 if(/^ELIM\b/.test(text))return "ELIM";
 return null;
};
const normalize=(value)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"").trim();
export function parseProgressTable(html,episodes,queens){
 const knownEpisodes=new Set(episodes.map(x=>x.number));
 const queenLookup=new Map();
 for(const queen of queens){
  for(const name of [queen.name,...(queen.aliases??[])]){
   const key=normalize(name);
   if(!key)continue;
   queenLookup.set(key,queenLookup.has(key)&&queenLookup.get(key)?.id!==queen.id?null:queen);
  }
 }
 const tables=[...html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)]
  .filter(match=>/\bclass\s*=\s*["'][^"']*wikitable/i.test(match[1]??""));
 for(const table of tables){
  const rawRows=[...(table[2]??"").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(x=>x[1]??"");
  const grid=expandRows(rawRows);
  const headerIndex=grid.findIndex(row=>row.some(cell=>/contestant|queen|drag name/i.test(cell??""))&&row.filter(cell=>cell!==undefined&&episodeNumber(cell)!==null).length>=2);
  if(headerIndex<0)continue;
  const header=grid[headerIndex]??[];
  const nameColumn=header.findIndex(cell=>/contestant|queen|drag name/i.test(cell??""));
  const episodeColumns=header.map((cell,index)=>({index,number:cell?episodeNumber(cell):null})).filter(x=>x.number!==null&&knownEpisodes.has(x.number));
  if(nameColumn<0||episodeColumns.length<2)continue;
  const placements=[];
  for(const row of grid.slice(headerIndex+1)){
   const rawName=row[nameColumn]??"";
   const queen=queenLookup.get(normalize(rawName));
   if(!queen)continue;
   for(const column of episodeColumns){
    const raw=row[column.index]??"";
    const code=placementCode(raw);
    if(code)placements.push({queenId:queen.id,episode:column.number,raw,code});
   }
  }
  return placements;
 }
 return [];
}
