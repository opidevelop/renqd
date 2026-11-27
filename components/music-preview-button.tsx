"use client";
import {useRef,useState} from "react";
import {Pause,Play} from "lucide-react";
export function MusicPreviewButton({src,title}:{src?:string;title:string}){
 const audioRef=useRef<HTMLAudioElement>(null);const[playing,setPlaying]=useState(false);
 async function toggle(){const audio=audioRef.current;if(!audio||!src)return;if(playing){audio.pause();setPlaying(false);return;}document.querySelectorAll<HTMLAudioElement>("audio[data-renqd-preview]").forEach(other=>{if(other!==audio&&!other.paused){other.pause();other.currentTime=0;}});try{await audio.play();setPlaying(true);}catch{setPlaying(false);}}
 const unavailable=!src;
 return <><audio ref={audioRef} data-renqd-preview src={src} preload="none" onEnded={()=>setPlaying(false)} onPause={()=>setPlaying(false)}/><button type="button" className="music-action preview-action" onClick={()=>void toggle()} disabled={unavailable} aria-label={unavailable?"Anteprima non disponibile per "+title:(playing?"Pausa ":"Ascolta ")+title} title={unavailable?"Anteprima non disponibile":"Ascolta anteprima"}>{playing?<Pause size={15}/>:<Play size={15}/>}</button></>;
}
