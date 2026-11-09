import { BookOpen, Clapperboard, Compass, Gamepad2, Music2, Sparkles, Utensils } from "lucide-react";
const categories=[
 {n:"01",title:"Musica",description:"Album, artisti, generi e canzoni.",icon:Music2,tone:"music"},
 {n:"02",title:"Cinema e serie TV",description:"Film, saghe, personaggi e serie.",icon:Clapperboard,tone:"screen"},
 {n:"03",title:"Videogiochi",description:"Titoli, console e universi da esplorare.",icon:Gamepad2,tone:"games"},
 {n:"04",title:"Libri",description:"Romanzi, autori e storie indimenticabili.",icon:BookOpen,tone:"books"},
 {n:"05",title:"Food & lifestyle",description:"Sapori, viaggi, luoghi e passioni.",icon:Utensils,tone:"food"},
 {n:"06",title:"Community",description:"Classifiche create dalle persone.",icon:Sparkles,tone:"community"},
];
export default function ExplorePage(){return <div className="explore-page">
 <div className="platform-page-heading"><div><div className="platform-overline"><Compass size={13}/> IL MONDO RENQD</div><h1>Lasciati ispirare.</h1><p>Un nuovo interesse può iniziare da una classifica.</p></div></div>
 <section className="explore-intro"><div><span>IL TUO PROSSIMO ARGOMENTO</span><h2>Ogni passione<br/>ha il suo <em>posto.</em></h2><p>Esplora per categoria e trova lo spunto per creare il tuo prossimo Renq.</p></div><div className="explore-orbit" aria-hidden="true"><span>R</span><i>✳</i></div></section>
 <div className="explore-section-heading"><div><span className="platform-overline">SEGUI LE TUE CURIOSITÀ</span><h2>Esplora per categoria</h2></div><small>06 MONDI</small></div>
 <div className="platform-category-grid explore-category-grid">{categories.map(({n,title,description,icon:Icon,tone})=><article className={`platform-category explore-category explore-${tone}`} key={n}><div className="explore-category-top"><span>{n}</span><Icon size={19}/></div><h3>{title}</h3><p>{description}</p></article>)}</div>
 <div className="explore-coming"><span className="explore-coming-dot"/><div><strong>La community si sta preparando.</strong><p>Le classifiche pubbliche saranno presto disponibili qui.</p></div><span className="explore-coming-label">IN ARRIVO</span></div>
 </div>;}
