import Link from "next/link";
import {ArrowLeft,ArrowUpRight,Music2,GitBranch,Disc3} from "lucide-react";

const modes=[
 {title:"Guess the Lipsync",description:"Ascolta il brano e indovina entrambe le Queen del lipsync.",href:"/drag-race/lalaparuza/guess-the-lipsync",icon:Music2,ready:true},
 {title:"Slayoff",description:"Crea un torneo a eliminazione diretta e scegli chi passa il turno.",href:"/drag-race/lalaparuza/slayoff",icon:GitBranch,ready:true},
 {title:"Lipsync for Your Life",description:"Una sfida dopo l'altra: scegli la vincitrice e continua finché vuoi.",href:"/drag-race/lalaparuza/lipsync-for-your-life",icon:Disc3,ready:true}
];
export default function LalaparuzaPage(){return <main className="drag-race-page"><Link className="drag-back" href="/drag-race"><ArrowLeft size={16}/> Drag Race</Link><header className="drag-game-heading"><span>RUPAUL’S DRAG RACE · GAME CENTER</span><h1>Lala <em>paruza.</em></h1><p>Tre modalità, un solo palco. Scegli la sfida e lascia parlare le Queen.</p></header><section className="drag-lalaparuza-grid">{modes.map(({title,description,href,icon:Icon,ready})=>ready?<Link className="drag-lalaparuza-card" key={title} href={href}><span><Icon size={24}/></span><h2>{title}</h2><p>{description}</p><strong>Gioca <ArrowUpRight size={14}/></strong></Link>:<article className="drag-lalaparuza-card is-coming" key={title}><span><Icon size={24}/></span><h2>{title}</h2><p>{description}</p><small>In implementazione</small></article>)}</section></main>}
