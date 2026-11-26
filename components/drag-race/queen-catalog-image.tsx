"use client";
type Props={id:string;name:string;src?:string|null;className?:string};
export function QueenCatalogImage({id,name,src,className}:Props){
 const imagePath="/api/drag-race/queen-image?id="+encodeURIComponent(id);
 return <a className={className??"drag-queen-image-source"} href={imagePath+"&source=1"} target="_blank" rel="noreferrer" title={"Apri la fonte e la licenza dell'immagine di "+name} aria-label={"Fonte e licenza immagine: "+name}><img src={src||imagePath} alt={name} loading="lazy" decoding="async" referrerPolicy="no-referrer"/></a>;
}