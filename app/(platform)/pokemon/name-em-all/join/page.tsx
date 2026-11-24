import Link from "next/link";
import { redirect } from "next/navigation";
import { joinNameEmAllByTokenAction } from "../actions";

export const dynamic="force-dynamic";

export default async function JoinNameEmAllPage({searchParams}:{searchParams:Promise<{token?:string}>}) {
  const {token}=await searchParams;
  if(!token)return <main className="pokemon-page"><section className="pokemon-nae-lobby-panel"><h1>Link non valido</h1><p>Il link di invito non contiene un codice valido.</p><Link href="/pokemon/name-em-all">Vai a Name ’Em All</Link></section></main>;
  const result=await joinNameEmAllByTokenAction(token);
  if(result.ok)redirect("/pokemon/name-em-all");
  return <main className="pokemon-page"><section className="pokemon-nae-lobby-panel"><span className="pokemon-page-eyebrow">NAME ’EM ALL</span><h1>Non è stato possibile entrare.</h1><p>{result.error??"Il link potrebbe essere scaduto o la lobby al completo."}</p><Link href="/pokemon/name-em-all">Torna a Name ’Em All</Link></section></main>;
}
