import {useEffect,useMemo,useState} from "react";
import type {Catalog} from "./types";
import type {SmartFilter,SmartVideo} from "./smart-types";
import {DEFAULT_FILTER,selectVideos,validateFilter} from "./smart-domain";
import {channelsInGroup} from "./groups";
import {useSmartFeed} from "./useSmartFeed";
import {SmartVideoCard} from "./SmartVideoCard";
import {useWatchState} from "./useWatchState";
type Mode="inbox"|"feed"|"board";
interface Props {catalog:Catalog;groupId:string|null;mode:Mode;onOpenGroup:(id:string)=>void}

export function SmartWorkspace({catalog,groupId,mode,onOpenGroup}:Props){
 const scope=mode==="feed"?groupId:null;
 const {feed,busy,error,refresh,action,markWatched}=useSmartFeed(scope,catalog.revision);
 const {state:watchState,add:enqueue,error:queueError}=useWatchState();
 const queuedIds=useMemo(()=>new Set(watchState.queue.map(v=>v.id)),[watchState.queue]);
 const storageKey="smartFilter:v1:"+mode+":"+(scope??"all");
 const [filter,setFilter]=useState<SmartFilter>({...DEFAULT_FILTER});
 const [playing,setPlaying]=useState<SmartVideo|null>(null);
 const [limit,setLimit]=useState(96);
 const [groupLimit,setGroupLimit]=useState(12);
 const [autoRefresh,setAutoRefresh]=useState(false);
 const [refreshError,setRefreshError]=useState("");
 const [controlsError,setControlsError]=useState("");
 useEffect(()=>{
  let live=true;
  setFilter({...DEFAULT_FILTER,...(mode==="inbox"?{read:"unread" as const}:{})});
  void chrome.storage.local.get(storageKey).then(obj=>{
   if(live&&obj[storageKey])setFilter(validateFilter(obj[storageKey]));
  }).catch(e=>{if(live)setControlsError(String(e));});
  return ()=>{live=false;};
 },[storageKey,mode]);
 useEffect(()=>{
  let live=true;
  void chrome.storage.local.get(["smartAutoRefreshEnabled","smartRefreshError"]).then(obj=>{
   if(live){setAutoRefresh(obj.smartAutoRefreshEnabled===true);
    setRefreshError(typeof obj.smartRefreshError==="string"?obj.smartRefreshError:"");}
  }).catch(()=>undefined);
  const changed=(updates:{[key:string]:chrome.storage.StorageChange},area:string)=>{
   if(area!=="local")return;
   if(updates.smartAutoRefreshEnabled)setAutoRefresh(updates.smartAutoRefreshEnabled.newValue===true);
   if(updates.smartRefreshError)setRefreshError(String(updates.smartRefreshError.newValue??""));
  };
  chrome.storage.onChanged.addListener(changed);
  return()=>{live=false;chrome.storage.onChanged.removeListener(changed);};
 },[]);
 function changeFilter(patch:Partial<SmartFilter>):void{
  const next={...filter,...patch};setFilter(next);setLimit(96);
  void chrome.storage.local.set({[storageKey]:next}).catch(e=>setControlsError(String(e)));
 }
 function clearFilter():void{
  const next={...DEFAULT_FILTER,...(mode==="inbox"?{read:"unread" as const}:{})};
  setFilter(next);setLimit(96);
  void chrome.storage.local.set({[storageKey]:next}).catch(e=>setControlsError(String(e)));
 }
 const visible=useMemo(()=>selectVideos(feed?.videos??[],filter),[feed,filter]);
 const muted=new Set(feed?.mutedChannelIds??[]);
 const availableChannels=useMemo(()=>{
  const ids=scope===null?null:channelsInGroup(catalog,scope);
  return catalog.channels.filter(ch=>ch.subscribed&&(!ids||ids.has(ch.id))).sort((a,b)=>a.title.localeCompare(b.title,"tr"));
 },[catalog,scope]);
 const mutedChannels=catalog.channels.filter(ch=>muted.has(ch.id)).sort((a,b)=>a.title.localeCompare(b.title,"tr"));
 const sections=useMemo(()=>catalog.groups.map(group=>{
  const members=channelsInGroup(catalog,group.id);
  const videos=visible.filter(v=>members.has(v.channelId)).slice(0,6);
  const unread=(feed?.videos??[]).filter(v=>v.unread&&members.has(v.channelId)).length;
  return {group,members:members.size,videos,unread};
 }).filter(item=>item.members>0),[catalog,visible,feed]);
 const title=mode==="inbox"?"Yeni videolar gelen kutusu":mode==="board"?"Gruplar arası video panosu":
  (catalog.groups.find(g=>g.id===groupId)?.name??"Tüm kanallar")+" · Video akışı";
 function readVideo(video:SmartVideo):void{
  setPlaying(video);
  if(!video.read)void action({type:"SMART_READ_SET",videoId:video.id,read:true});
 }
 function cards(items:SmartVideo[]){
  return <div className="video-grid">{items.map(v=><SmartVideoCard key={v.id} video={v} queued={queuedIds.has(v.id)}
   onQueue={v=>{void enqueue(v);}}
   onPlay={readVideo}
   onRead={(videoId,read)=>{void action({type:"SMART_READ_SET",videoId,read});}}
   onWatched={(videoId,watched)=>{void markWatched(videoId,watched);}}
   onMute={channelId=>{void action({type:"SMART_MUTE_SET",channelId,muted:true});}}/>)}</div>;
 }
 return <section className="videos-workspace smart-workspace">
  <div className="videos-heading">
   <div><span className="eyebrow">TUBESHELF · AKILLI AKIŞ</span><h1>{title}</h1>
    <p>Kanallarından gelen yayınları incele; grupların ve izleme durumun yerel olarak saklanır.</p>
   </div>
   <button className="video-refresh" disabled={busy} onClick={()=>{void refresh(true);}}>
    {busy?"⏳ Taranıyor…":"↻ Yeni videoları getir"}</button>
  </div>
  <div className="smart-stats">
   <div><strong>{feed?.unreadCount??"—"}</strong><span>Yeni / okunmamış</span></div>
   <div><strong>{feed?.videos.length??"—"}</strong><span>Önbellekteki video</span></div>
   <div><strong>{feed?.loadedChannels??"—"} / {feed?.totalChannels??"—"}</strong><span>Taranan kanal</span></div>
   <div><strong>{feed?.pendingChannels??"—"}</strong><span>Yenileme bekleyen</span></div>
  </div>
  <div className="smart-actions">
   <button disabled={!feed?.unreadCount} onClick={()=>{void action({type:"SMART_READ_ALL",groupId:scope});}}>
    ✓ Bu {scope?"gruptaki":"akıştaki"} yenileri okundu işaretle
   </button>
   <label><input type="checkbox" checked={autoRefresh} onChange={e=>{
    void chrome.storage.local.set({smartAutoRefreshEnabled:e.target.checked}).catch(err=>setControlsError(String(err)));
   }}/> Tarayıcı açıkken saatte bir kontrol et</label>
  </div>
  <div className="smart-filters">
   <label>Arama<input value={filter.query} maxLength={160} placeholder="Video veya kanal…" onChange={e=>changeFilter({query:e.target.value})}/></label>
   <label>Kanal<select value={filter.channelId} onChange={e=>changeFilter({channelId:e.target.value})}>
    <option value="">Tüm kanallar</option>
    {availableChannels.map(ch=><option key={ch.id} value={ch.id}>{ch.title}</option>)}
   </select></label>
   <label>Yayın tarihi<select value={filter.days} onChange={e=>changeFilter({days:Number(e.target.value) as SmartFilter["days"]})}>
    <option value={0}>Tüm tarihler</option><option value={1}>Son 24 saat</option>
    <option value={7}>Son 7 gün</option><option value={30}>Son 30 gün</option>
   </select></label>
   <label>İçerik türü<select value={filter.kind} onChange={e=>changeFilter({kind:e.target.value as SmartFilter["kind"]})}>
    <option value="all">Tümü</option><option value="video">Videolar</option><option value="short">Shorts</option>
    <option value="live">Canlı / kayıt</option><option value="unknown">Türü belirsiz</option>
   </select></label>
   <label>Okunma<select value={filter.read} onChange={e=>changeFilter({read:e.target.value as SmartFilter["read"]})}>
    <option value="all">Tümü</option><option value="unread">Yalnızca yeni</option><option value="read">Yeni olmayanlar</option>
   </select></label>
   <label>İzleme<select value={filter.watched} onChange={e=>changeFilter({watched:e.target.value as SmartFilter["watched"]})}>
    <option value="all">Tümü</option><option value="unwatched">İzlenmeyenler</option><option value="watched">İzlenenler</option>
   </select></label>
   <label>Sıralama<select value={filter.sort} onChange={e=>changeFilter({sort:e.target.value as SmartFilter["sort"]})}>
    <option value="newest">Yeniden eskiye</option><option value="oldest">Eskiden yeniye</option><option value="channel">Kanal adına göre</option>
   </select></label>
   <button className="smart-clear" onClick={clearFilter}>Filtreleri sıfırla</button>
  </div>
  <details className="smart-muted">
   <summary>Sessize alınan kanallar ({mutedChannels.length})</summary>
   <p>Sessiz kanallar aboneliklerinden ve gruplarından silinmez, yalnızca TubeShelf video akışında gizlenir.</p>
   <div className="mute-pick">
    <select aria-label="Sessize alınacak kanal" value={filter.channelId} onChange={e=>changeFilter({channelId:e.target.value})}>
     <option value="">Kanal seçin</option>
     {availableChannels.filter(ch=>!muted.has(ch.id)).map(ch=><option key={ch.id} value={ch.id}>{ch.title}</option>)}
    </select>
    <button disabled={!filter.channelId||muted.has(filter.channelId)}
     onClick={()=>{void action({type:"SMART_MUTE_SET",channelId:filter.channelId,muted:true});}}>Seçili kanalı sessize al</button>
   </div>
   {mutedChannels.map(ch=><div className="mute-row" key={ch.id}><span>{ch.title}</span>
    <button onClick={()=>{void action({type:"SMART_MUTE_SET",channelId:ch.id,muted:false});}}>Sesi aç</button>
   </div>)}
  </details>
  {feed&&<p className="video-meta" role="status">
   {visible.length} eşleşen video · {feed.loadedChannels}/{feed.totalChannels} kanal erişildi
   {feed.failedChannels>0?" · "+feed.failedChannels+" eksik/hatalı kaynak":""}
   {feed.lastBatch?" · Bu tur "+feed.lastBatch.attempted+" kanal denendi":""}
   {feed.updatedAt?" · Son kayıt "+new Date(feed.updatedAt).toLocaleString("tr-TR"):""}
  </p>}
  {(error||controlsError||refreshError||queueError)&&<div className="notice error" role="alert">{error||controlsError||refreshError||queueError}</div>}
  {feed?.errors.length?<details className="feed-details"><summary>Kaynak sorunları ve belirsiz video türleri</summary>
   <ul>{feed.errors.map((msg,i)=><li key={i}>{msg}</li>)}</ul>
   <p>Shorts ve canlı sınıflandırması resmî olmayan yayınlara bağlıdır; kaynak erişilemiyorsa kesin sonuç verilmez.</p>
  </details>:null}
  {!feed?<div className="video-empty">Gelen kutusu hazırlanıyor…</div>:mode!=="board"?<>
   {visible.length?cards(visible.slice(0,limit)):<div className="video-empty">
    <strong>{mode==="inbox"?"Yeni video görünmüyor.":"Bu filtrelerde video yok."}</strong>
    <p>{feed.totalChannels===0?"Kanalları gruplara ekleyin veya sessiz kanalları kontrol edin.":
      "Yeni videoları getir düğmesini deneyin ya da filtreleri sıfırlayın."}</p>
   </div>}
   {visible.length>limit&&<button className="load-more" onClick={()=>setLimit(n=>n+96)}>Daha fazla video göster</button>}
  </>:<>
   {catalog.groups.length===0&&<div className="video-empty">Video panosu için önce grup oluşturun.</div>}
   <div className="board-grid">{sections.slice(0,groupLimit).map(section=><section className="board-section" key={section.group.id}>
    <div className="board-title"><button onClick={()=>onOpenGroup(section.group.id)}>{section.group.name} ↗</button>
     <small>{section.unread} yeni · {section.members} kanal</small></div>
    {section.videos.length?cards(section.videos):<p className="board-empty">Bu grubun filtrelerle eşleşen videosu yok.</p>}
   </section>)}</div>
   {sections.length>groupLimit&&<button className="load-more" onClick={()=>setGroupLimit(n=>n+12)}>Diğer grupları göster</button>}
  </>}
  <p className="smart-disclaimer">Yeni sayaçları TubeShelf'ün başlangıcından sonraki, alınabilen yayınları gösterir. Bunlar YouTube hesabının resmî okunmamış bildirim sayıları değildir.</p>
  {playing&&<div className="video-modal-backdrop" role="presentation" onClick={()=>setPlaying(null)}>
   <div className="video-modal" role="dialog" aria-modal="true" aria-label="Video oynatıcı" onClick={e=>e.stopPropagation()}>
    <div className="video-modal-bar"><strong>{playing.title}</strong><button onClick={()=>setPlaying(null)} aria-label="Oynatıcıyı kapat">✕</button></div>
    <iframe title={playing.title} src={"https://www.youtube-nocookie.com/embed/"+playing.id+"?autoplay=1"}
      allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
    <div className="video-modal-actions"><p>Gömülü oynatıcı izlemeyi otomatik kaydetmez.</p>
     <button onClick={()=>{void markWatched(playing.id,true);setPlaying(null);}}>✓ İzledim</button>
     <a href={playing.url} target="_blank" rel="noopener noreferrer">YouTube'da aç ↗</a></div>
   </div>
  </div>}
 </section>;
}
