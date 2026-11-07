"use client";

import { useCallback, useRef, type ReactNode } from "react";

function rgbToHsl(r: number, g: number, b: number) {
  const red=r/255, green=g/255, blue=b/255;
  const max=Math.max(red,green,blue), min=Math.min(red,green,blue);
  const delta=max-min;
  let h=0;
  const l=(max+min)/2;
  const s=delta===0?0:delta/(1-Math.abs(2*l-1));
  if(delta!==0){
    if(max===red) h=((green-blue)/delta)%6;
    else if(max===green) h=(blue-red)/delta+2;
    else h=(red-green)/delta+4;
    h=Math.round(h*60); if(h<0) h+=360;
  }
  return {h,s,l};
}

export function DynamicCoverTheme({ imageSrc, children }: { imageSrc: string; children: ReactNode }) {
  const rootRef=useRef<HTMLDivElement>(null);
  const applyCoverPalette=useCallback((event: React.SyntheticEvent<HTMLImageElement>)=>{
    const image=event.currentTarget;
    const root=rootRef.current;
    if(!root || !image.naturalWidth) return;
    try {
      const canvas=document.createElement("canvas");
      const context=canvas.getContext("2d",{willReadFrequently:true});
      if(!context) return;
      canvas.width=48; canvas.height=48;
      context.drawImage(image,0,0,48,48);
      const pixels=context.getImageData(0,0,48,48).data;
      const buckets=new Map<string,{r:number;g:number;b:number;count:number}>();
      for(let i=0;i<pixels.length;i+=16){
        const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
        const {s,l}=rgbToHsl(r,g,b);
        if(l<.13 || l>.88 || s<.16) continue;
        const key=[r>>5,g>>5,b>>5].join("-");
        const item=buckets.get(key)??{r:0,g:0,b:0,count:0};
        item.r+=r;item.g+=g;item.b+=b;item.count++;
        buckets.set(key,item);
      }
      const ranked=[...buckets.values()].sort((a,b)=>b.count-a.count);
      if(!ranked.length) return;
      const color=(item:{r:number;g:number;b:number;count:number})=>`rgb(${Math.round(item.r/item.count)}, ${Math.round(item.g/item.count)}, ${Math.round(item.b/item.count)})`;
      const dominant=ranked[0];
      const secondary=ranked.find((item)=>Math.abs(item.r/item.count-dominant.r/dominant.count)+Math.abs(item.g/item.count-dominant.g/dominant.count)+Math.abs(item.b/item.count-dominant.b/dominant.count)>55)??ranked[Math.min(1,ranked.length-1)]??dominant;
      root.style.setProperty("--rank-a",color(dominant));
      root.style.setProperty("--rank-b",color(secondary));
      root.dataset.paletteReady="true";
    } catch {
      root.dataset.paletteReady="fallback";
    }
  },[]);
  return <div ref={rootRef} className="dynamic-cover-theme" style={{"--rank-a":"#8962b5","--rank-b":"#d3a7e6"} as React.CSSProperties}>
    <img className="dynamic-cover-source" src={imageSrc} alt="" aria-hidden="true" crossOrigin="anonymous" onLoad={applyCoverPalette}/>
    {children}
  </div>;
}
