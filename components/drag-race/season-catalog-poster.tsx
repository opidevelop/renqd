import Image from "next/image";
type Props={seasonId:string|null;title:string;className?:string};
export function SeasonCatalogPoster({seasonId,title,className}:Props){
 if(!seasonId)return <div className={className??"drag-season-poster-fallback"} aria-label={title}><span>{title}</span></div>;
 const image="/api/drag-race/season-image?id="+encodeURIComponent(seasonId);
 return <a className={className??"drag-season-poster"} href={image+"&source=1"} target="_blank" rel="noreferrer" title={"Apri la fonte e la licenza del poster di "+title} aria-label={"Fonte e licenza poster: "+title}><Image src={image} alt={title} width={180} height={240} unoptimized loading="lazy"/></a>;
}
