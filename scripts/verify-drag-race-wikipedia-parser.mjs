import assert from "node:assert/strict";
import {parseProgressTable} from "../supabase/functions/drag-race-track-record-wikipedia-sync/parser.js";
import {parseLipsyncTables} from "../supabase/functions/drag-race-catalog-sync/wikipedia-parser.js";

const episodes=[{number:1},{number:2},{number:3}];
const queens=[
 {id:"bebe",name:"BeBe Zahara Benet",aliases:["Bebe Zahara Benet"]},
 {id:"nina",name:"Nina Flowers",aliases:[]},
 {id:"porkchop",name:"Porkchop",aliases:["Victoria 'Porkchop' Parker"]}
];
const html=`
<table class="wikitable">
 <tr><th rowspan="2">Contestant</th><th colspan="3">Episode</th></tr>
 <tr><th>1</th><th>2</th><th>3</th></tr>
 <tr><th scope="row">BeBe Zahara Benet</th><td>SAFE</td><td>WIN<sup>[1]</sup></td><td>ELIM</td></tr>
 <tr><th scope="row">Nina Flowers</th><td>WIN</td><td>BTM</td><td>SAFE</td></tr>
 <tr><th scope="row">Victoria &quot;Porkchop&quot; Parker</th><td>BTM</td><td>IMM</td><td>Guest</td></tr>
</table>`;
const parsed=parseProgressTable(html,episodes,queens);
assert.equal(parsed.length,7,"recognized placement cells should be returned");
assert.deepEqual(parsed.filter(x=>x.queenId==="bebe").map(x=>[x.episode,x.code]),[[1,"SAFE"],[2,"WIN"],[3,"ELIM"]]);
assert.deepEqual(parsed.filter(x=>x.queenId==="nina").map(x=>[x.episode,x.code]),[[1,"WIN"],[2,"BTM"],[3,"SAFE"]]);
assert.deepEqual(parsed.filter(x=>x.queenId==="porkchop").map(x=>[x.episode,x.code]),[[1,"BTM"]]);

const ambiguous=parseProgressTable(html,episodes,[...queens,{id:"other",name:"Other Queen",aliases:["Nina Flowers"]}]);
assert.equal(ambiguous.some(x=>x.queenId==="nina"),false,"ambiguous aliases must not be matched");
console.log("Wikipedia Track Record parser: all checks passed.");

const lipQueens=[
 {id:"sahara",name:"Sahara Davenport",aliases:[]},
 {id:"shangela",name:"Shangela Laquifa Wadley",aliases:["Shangela"]},
 {id:"mimi",name:"Mimi Imfurst",aliases:["Mimi"]},
 {id:"chad",name:"Chad Michaels",aliases:["Chad"]}
];
const regularLipSync=parseLipsyncTables(`
<table class="wikitable">
 <tr><th>Episode</th><th>Contestants</th><th>Song</th><th>Eliminated</th></tr>
 <tr><td>1 [1]</td><td>Sahara Davenport</td><td>vs.</td><td>Shangela Laquifa Wadley</td><td>"Cover Girl (Put the Bass in Your Walk)" (RuPaul)</td><td>Shangela</td></tr>
</table>`,episodes,lipQueens);
assert.equal(regularLipSync.length,1,"regular two-Queen lip sync should be parsed");
assert.deepEqual(regularLipSync[0].queenIds,["sahara","shangela"]);
assert.equal(regularLipSync[0].songTitle,"Cover Girl (Put the Bass in Your Walk)");
assert.equal(regularLipSync[0].songArtist,"RuPaul");
const teamLipSync=parseLipsyncTables(`
<table class="wikitable">
 <tr><th>Episode</th><th>Bottom teams (Lip syncers)</th><th>Song</th><th>Eliminated</th></tr>
 <tr><td>1</td><td>Mandora (Mimi)</td><td>vs.</td><td>Shad (Chad)</td><td>"Opposites Attract" (Paula Abdul)</td><td>Mandora</td></tr>
</table>`,episodes,lipQueens);
assert.equal(teamLipSync.length,1,"team-season row should resolve the individual lip syncers");
assert.deepEqual(teamLipSync[0].queenIds,["mimi","chad"]);
const tripleLipSync=parseLipsyncTables(`
<table class="wikitable">
 <tr><th>Episode</th><th>Contestants</th><th>Song</th></tr>
 <tr><td>1</td><td>Sahara Davenport</td><td>vs.</td><td>Shangela Laquifa Wadley</td><td>vs.</td><td>Mimi Imfurst</td><td>"A Song" (Artist)</td></tr>
</table>`,episodes,lipQueens);
assert.equal(tripleLipSync.length,0,"three-Queen rows must be excluded from two-Queen guessing mode");
console.log("Wikipedia Track Record and Lipsync parsers: all checks passed.");
