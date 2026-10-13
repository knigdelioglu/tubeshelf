import {useEffect,useMemo,useState} from "react";
import {useWatchState} from "./useWatchState";
import {resumeUrl} from "./watch-domain";
import type {QueuedVideo,PlaybackProgress} from "./watch-types";
import {formatVideoDate} from "./feed-domain";

function elapsed(seconds:number):string{
 const s=Math.floor(seconds);
 return [Math.floor(s/3600),Math.floor(s/60)%60,s%60].map((n,i)=>i===0?String(n):String(n).padStart(2,"0")).filter((_,i)=>i>0||s>=3600).join(":");
}
export function QueueWorkspace(){
 const {state,busy,error,action,move,remove}=useWatchState();
 const [index,setIndex]=useState(0);
 const [focus,setFocus]=useState(false);
 const [playing,setPlaying]=useState<QueuedVideo|null>(null);
 const [dragging,setDragging]=useState<string|null>(null);
 const current=state.queue[Math.min(index,state.queue.length-1)]??null;
 const progress=useMemo(()=>new Map(state.progress.map(p=>[p.videoId,p])),[state.progress]);
 useEffect(()=>{
  document.body.classList.toggle("tubeshelf-focus",focus);
  return ()=>{document.body.classList.remove("tubeshelf-focus");};
 },[focus]);
 useEffect(()=>{
  let active=true;
  void chrome.storage.local.get("queueFocusMode").then(values=>{if(active)setFocus(values.queueFocusMode===true);}).catch(()=>undefined);
  return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(index>=state.queue.length&&state.queue.length>0)setIndex(state.queue.length-1);
 },[state.queue.length,index]);
 useEffect(()=>{
  function keys(e:KeyboardEvent){
   const t=e.target;
   if(e.ctrlKey||e.metaKey||e.altKey||t instanceof HTMLInputElement||t instanceof HTMLTextAreaElement||
      t instanceof HTMLSelectElement||(t instanceof HTMLElement&&
      (t.isContentEditable||Boolean(t.closest("button,a,[role=button]")))))return;
   const key=e.key.toLowerCase();
   if(key==="escape"){setPlaying(null);return;}
   if(key==="j"){e.preventDefault();setIndex(n=>Math.min(state.queue.length-1,Math.max(0,n+1)));}
   if(key==="k"){e.preventDefault();setIndex(n=>Math.max(0,n-1));}
   if(key==="f"){e.preventDefault();changeFocus(!focus);}
   if(key==="enter"&&current){e.preventDefault();setPlaying(current);}
   if(key==="m"&&current){e.preventDefault();void action({type:"WATCH_COMPLETE",videoId:current.id});}
  }
  window.addEventListener("keydown",keys);
  return()=>window.removeEventListener("keydown",keys);
 },[current,focus,state.queue.length,progress,action]);
 function changeFocus(on:boolean){
  setFocus(on);
  void chrome.storage.local.set({queueFocusMode:on});
 }
 function displayProgress(p?:PlaybackProgress):string{
  if(!p)return "Henüz başlamadı";
  return p.completed?"Tamamlandı":elapsed(p.position)+" / "+elapsed(p.duration);
 }
 function play(video:QueuedVideo){
  setIndex(Math.max(0,state.queue.findIndex(item=>item.id===video.id)));
  setPlaying(video);
 }
 function openAtPosition(video:QueuedVideo){
  window.open(resumeUrl(video,progress.get(video.id)),"_blank","noopener,noreferrer");
 }
 return <section className={"queue-workspace "+(focus?"focus-mode":"")}>
  <div className="videos-heading">
   <div><span className="eyebrow">TUBESHELF · İZLEME DENEYİMİ</span><h1>İzleme kuyruğu</h1>
    <p>{state.queue.length} video · Kaldığın yerden devam et, sırala ve izle.</p></div>
   <div className="queue-toolbar">
    <button onClick={()=>changeFocus(!focus)} aria-pressed={focus}>{focus?"◉ Odak modu açık":"◎ Odak modu"}</button>
    <button disabled={busy||!state.queue.length} onClick={()=>{
     if(confirm("Kuyruktaki bütün videolar kaldırılsın mı? İzleme ilerlemeleri korunur."))
      void action({type:"WATCH_QUEUE_CLEAR"});
    }}>Kuyruğu boşalt</button>
   </div>
  </div>
  {error&&<div className="notice error" role="alert">{error}</div>}
  <div className="queue-layout">
   <div className="queue-list" aria-label="İzleme kuyruğu">
    {!state.queue.length&&<div className="video-empty"><strong>Kuyruk boş.</strong><p>Akıştaki videoların “Kuyruğa ekle” düğmesini kullan.</p></div>}
    {state.queue.map((video,i)=>{
     const p=progress.get(video.id);
     return <article key={video.id} className={"queue-row "+(current?.id===video.id?"queue-selected":"")}
      draggable onDragStart={e=>{setDragging(video.id);e.dataTransfer.setData("text/x-tubeshelf-queue",video.id);e.dataTransfer.effectAllowed="move";}}
      onDragEnd={()=>setDragging(null)}
      onDragOver={e=>{if(e.dataTransfer.types.includes("text/x-tubeshelf-queue"))e.preventDefault();}}
      onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("text/x-tubeshelf-queue")||dragging;
       if(id)void move(id,i);setDragging(null);}}>
      <button className="queue-item-main" onClick={()=>{setIndex(i);setPlaying(video);}} aria-label={video.title+" oynat"}>
       <img src={video.thumbnail} alt="" loading="lazy"/>
       <span><strong>{video.title}</strong><small>{video.channelTitle} · {formatVideoDate(video.publishedAt)}</small>
        <small>{displayProgress(p)}</small>
        {p&&<span className="queue-progress-bar"><span style={{width:(p.duration>0?Math.min(100,p.position/p.duration*100):0)+"%"}}/></span>}
       </span>
      </button>
      <div className="queue-controls">
       <button disabled={busy||i===0} title="Yukarı taşı" onClick={()=>{void move(video.id,i-1);}}>↑</button>
       <button disabled={busy||i===state.queue.length-1} title="Aşağı taşı" onClick={()=>{void move(video.id,i+1);}}>↓</button>
       <button title="Kuyruktan çıkar" onClick={()=>{void remove(video.id);}}>×</button>
      </div>
     </article>;
    })}
   </div>
   <aside className="queue-side">
    <h2>Şimdi izle</h2>
    {current?<><img className="queue-preview" src={current.thumbnail} alt=""/>
     <strong>{current.title}</strong><p>{current.channelTitle}</p>
     <p className="queue-position">{displayProgress(progress.get(current.id))}</p>
     <button className="video-refresh" onClick={()=>play(current)}>▶ TubeShelf içinde oynat</button>
     <button onClick={()=>openAtPosition(current)}>↗ YouTube'da kaldığın yerden aç</button>
     {progress.has(current.id)&&<button onClick={()=>{void action({type:"WATCH_PROGRESS_RESET",videoId:current.id});}}>İlerlemeyi sıfırla</button>}
    </>:<p>Akıştan video ekle.</p>}
    <p className="queue-help">Kısayollar: <kbd>J</kbd>/<kbd>K</kbd> sonraki/önceki, <kbd>Enter</kbd> oynat, <kbd>F</kbd> odak, <kbd>M</kbd> tamamla, <kbd>Esc</kbd> kapat.</p>
   </aside>
  </div>
  {playing&&<div className="video-modal-backdrop" role="presentation" onClick={()=>setPlaying(null)}>
   <div className="video-modal" role="dialog" aria-modal="true" aria-label="Kuyruk video oynatıcı" onClick={e=>e.stopPropagation()}>
    <div className="video-modal-bar"><strong>{playing.title}</strong><button onClick={()=>setPlaying(null)} aria-label="Oynatıcıyı kapat">✕</button></div>
    <iframe title={playing.title}
     src={"https://www.youtube-nocookie.com/embed/"+playing.id+"?autoplay=1&start="+Math.max(0,Math.floor((progress.get(playing.id)?.completed?0:progress.get(playing.id)?.position??0)-3))}
     allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
    <div className="video-modal-actions">
     <p>Gömülü videonun ilerlemesi otomatik ölçülemez. YouTube'da açarak ilerlemeyi kaydedebilirsin.</p>
     <button onClick={()=>{void action({type:"WATCH_COMPLETE",videoId:playing.id});
      setPlaying(null);}}>✓ Tamamlandı</button>
     <button disabled={state.queue.findIndex(v=>v.id===playing.id)>=state.queue.length-1}
      onClick={()=>{
       const nextIndex=state.queue.findIndex(v=>v.id===playing.id)+1;
       const next=state.queue[nextIndex];
       if(next){setIndex(nextIndex);setPlaying(next);}
      }}>Sonraki →</button>
     <a href={resumeUrl(playing,progress.get(playing.id))} target="_blank" rel="noopener noreferrer">YouTube'da devam et ↗</a>
    </div>
   </div>
  </div>}
 </section>;
}
