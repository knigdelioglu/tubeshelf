import {useMemo,useState} from "react";
import type {Catalog} from "./types";
import type {VideoFeedItem,VideoKind} from "./video-types";
import {channelsInGroup} from "./groups";
import {filterVideos,formatVideoDate} from "./feed-domain";
import {useVideoFeed} from "./useVideoFeed";

interface Props{
 catalog:Catalog;groupId:string|null;mode:"feed"|"board";
 onOpenGroup:(id:string)=>void;
}
const kindLabels:Record<VideoKind,string>={video:"Video",short:"Shorts",live:"Canlı yayın",unknown:"Türü belirsiz"};
function VideoCard({video,onWatch,onOpen}:{
 video:VideoFeedItem;onWatch:(id:string,watched:boolean)=>void;onOpen:(v:VideoFeedItem)=>void;
}){
 return <article className={"video-card "+(video.watched?"video-watched":"")}>
  <button className="video-cover" onClick={()=>onOpen(video)} aria-label={video.title+" oynat"}>
   <img src={video.thumbnail} alt="" loading="lazy"/>
   <span className="video-play" aria-hidden="true">▶</span>
   <span className={"video-kind kind-"+video.kind}>{kindLabels[video.kind]}</span>
  </button>
  <div className="video-info">
   <h3 title={video.title}>{video.title}</h3>
   <p>{video.channelTitle} · {formatVideoDate(video.publishedAt)}</p>
   <div className="video-actions">
    <button onClick={()=>onWatch(video.id,!video.watched)} aria-pressed={video.watched}>
     {video.watched?"✓ İzledim":"○ İzledim olarak işaretle"}
    </button>
    <a href={video.url} target="_blank" rel="noopener noreferrer">YouTube'da aç ↗</a>
   </div>
  </div>
 </article>;
}
export function VideoWorkspace({catalog,groupId,mode,onOpenGroup}:Props){
 const scope=mode==="board"?null:groupId;
 const {feed,busy,error,refresh,markWatched}=useVideoFeed(scope,catalog.revision);
 const [hideShorts,setHideShorts]=useState(false);
 const [hideLive,setHideLive]=useState(false);
 const [hideWatched,setHideWatched]=useState(false);
 const [days,setDays]=useState<0|7|30>(0);
 const [query,setQuery]=useState("");
 const [playing,setPlaying]=useState<VideoFeedItem|null>(null);
 const [groupLimit,setGroupLimit]=useState(12);
 const filtered=useMemo(()=>filterVideos(feed?.videos??[],{hideShorts,hideLive,hideWatched,query,days}),
  [feed,hideShorts,hideLive,hideWatched,query,days]);
 const group=catalog.groups.find(g=>g.id===groupId);
 const sections=useMemo(()=>catalog.groups.map(g=>{
  const members=channelsInGroup(catalog,g.id);
  const entries=filtered.filter(v=>members.has(v.channelId)).slice(0,6);
  return {group:g,entries,members:members.size};
 }).filter(section=>section.members>0||section.entries.length>0),[catalog,filtered]);
 const title=mode==="board"?"Gruplar arası video panosu":group?group.name+" · Son videolar":"Tüm aboneliklerin yeni videoları";
 function cards(videos:VideoFeedItem[]){return <div className="video-grid">{videos.map(v=>
  <VideoCard key={v.id} video={v} onWatch={(id,value)=>{void markWatched(id,value);}}
   onOpen={setPlaying}/>)}</div>;}
 return <section className="videos-workspace">
  <div className="videos-heading">
   <div><span className="eyebrow">{mode==="board"?"TÜM GRUPLAR":"SEÇİLEN GRUBUN VİDEOLARI"}</span>
    <h1>{title}</h1>
    <p>Yeni yüklenen içerikleri kanal gruplarına göre izle ve düzenle.</p>
   </div>
   <button className="video-refresh" disabled={busy} onClick={()=>{void refresh();}}>
    {busy?"⏳ Güncelleniyor…":"↻ Yeni videoları getir"}
   </button>
  </div>
  <div className="video-filters">
   <label className="video-search">⌕ <input aria-label="Videolarda ara" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Video veya kanal ara…"/></label>
   <label><input type="checkbox" checked={hideShorts} onChange={e=>setHideShorts(e.target.checked)}/> Shorts gizle</label>
   <label><input type="checkbox" checked={hideLive} onChange={e=>setHideLive(e.target.checked)}/> Canlı yayınları gizle</label>
   <label><input type="checkbox" checked={hideWatched} onChange={e=>setHideWatched(e.target.checked)}/> İzlediklerimi gizle</label>
   <select aria-label="Yayın tarihi" value={days} onChange={e=>setDays(Number(e.target.value) as 0|7|30)}>
    <option value={0}>Tüm tarihler</option><option value={7}>Son 7 gün</option><option value={30}>Son 30 gün</option>
   </select>
  </div>
  {feed&&<div className="video-meta" role="status">
   {feed.videos.length} video · {feed.loadedChannels}/{feed.totalChannels} kanal tarandı
   {feed.failedChannels>0&&<span className="feed-warning"> · {feed.failedChannels} kanalda eksik/hatalı veri</span>}
   {feed.updatedAt&&" · Son kontrol: "+new Date(feed.updatedAt).toLocaleString("tr-TR")}
   {feed.totalChannels>feed.loadedChannels&&" · Yeni videoları getir ile sıradaki kanalları tara"}
  </div>}
  {error&&<div className="notice error" role="alert">{error}</div>}
  {feed?.errors.length? <details className="feed-details"><summary>Kaynak uyarıları ({feed.errors.length} örnek)</summary>
   <ul>{feed.errors.map((message,i)=><li key={i}>{message}</li>)}</ul>
   <p>Shorts ve canlı yayın sınıflandırması, resmî olmayan kanal yayınlarının erişilebilirliğine bağlıdır. Belirsiz videolar gizlenmez.</p>
  </details>:null}
  {!feed?<div className="video-empty">Video önbelleği yükleniyor…</div>:mode==="feed"?<>
   {filtered.length?cards(filtered.slice(0,240)):<div className="video-empty">
    <strong>Gösterilecek video yok.</strong>
    <p>{feed.totalChannels===0?"Önce kanallarını bir gruba ekle veya tüm abonelikleri seç.":
     "Yeni videoları getir düğmesini kullan ya da filtreleri gevşet."}</p>
   </div>}
   {filtered.length>240&&<p className="video-meta">İlk 240 video gösteriliyor; tarih veya arama filtresiyle daraltabilirsin.</p>}
  </>:<>
   {!catalog.groups.length&&<div className="video-empty">Video panosu için önce gruplar oluştur.</div>}
   <div className="board-grid">{sections.slice(0,groupLimit).map(({group:g,entries,members})=>
    <section className="board-section" key={g.id}>
     <div className="board-title"><button onClick={()=>onOpenGroup(g.id)}>{g.name} <span>↗</span></button>
      <small>{members} kanal</small></div>
     {entries.length?cards(entries):<p className="board-empty">Bu grupta henüz yeni video bulunmadı.</p>}
    </section>)}</div>
   {sections.length>groupLimit&&<button className="load-more" onClick={()=>setGroupLimit(n=>n+12)}>Diğer grupları göster ({sections.length-groupLimit})</button>}
  </>}
  {playing&&<div className="video-modal-backdrop" role="presentation" onClick={()=>setPlaying(null)}>
   <div className="video-modal" role="dialog" aria-modal="true" aria-label="Video oynatıcı" onClick={e=>e.stopPropagation()}>
    <div className="video-modal-bar"><strong>{playing.title}</strong><button aria-label="Oynatıcıyı kapat" onClick={()=>setPlaying(null)}>✕</button></div>
    <iframe title={playing.title} src={"https://www.youtube-nocookie.com/embed/"+playing.id+"?autoplay=1"}
     allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
    <div className="video-modal-actions"><p>Video açılmıyorsa kanalda gömülü oynatma kapalı olabilir.</p>
     <button onClick={()=>{void markWatched(playing.id,true);setPlaying(null);}}>✓ İzledim</button>
     <a href={playing.url} target="_blank" rel="noopener noreferrer">YouTube'da aç ↗</a>
    </div>
   </div>
  </div>}
 </section>;
}
