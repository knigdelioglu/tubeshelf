import {useEffect,useMemo,useState} from "react";
import type {Catalog} from "./types";
import type {CenterPreferences,CenterAnalytics,CenterResponse,GroupNotificationConfig} from "./center-types";
import type {SmartVideo} from "./smart-types";
import {DEFAULT_CENTER,normalizeCenterPrefs,orderedGroups} from "./center-domain";
import {channelsInGroup} from "./groups";
import {useSmartFeed} from "./useSmartFeed";
import {useWatchState} from "./useWatchState";
import {send} from "./client";
import {formatVideoDate} from "./feed-domain";

interface Props {
 catalog:Catalog;
 onOpenGroup:(id:string)=>void;
 onQueue:()=>void;
 onInbox:()=>void;
}
const SETTINGS_KEY="centerPreferencesV1";
async function centerRequest(request:unknown):Promise<CenterResponse>{
 const result=await chrome.runtime.sendMessage(request) as CenterResponse;
 if(!result?.ok)throw new Error(result?.error??"Kişisel merkez isteği başarısız.");
 return result;
}
function GroupVideo({video}: {video:SmartVideo}){
 return <a className="center-video" href={video.url} target="_blank" rel="noopener noreferrer">
  <img src={video.thumbnail} alt="" loading="lazy"/>
  <span><strong>{video.title}</strong><small>{video.channelTitle} · {formatVideoDate(video.publishedAt)}</small></span>
  {video.unread&&<i className="center-new">Yeni</i>}
 </a>;
}
export function CenterWorkspace({catalog,onOpenGroup,onQueue,onInbox}:Props){
 const {feed,error:feedError,busy:feedBusy,refresh}=useSmartFeed(null,catalog.revision);
 const {state:watchState}=useWatchState();
 const [prefs,setPrefs]=useState<CenterPreferences>({...DEFAULT_CENTER});
 const [analytics,setAnalytics]=useState<CenterAnalytics|null>(null);
 const [notify,setNotify]=useState<GroupNotificationConfig|null>(null);
 const [message,setMessage]=useState("");
 const [busy,setBusy]=useState(false);
 const [showInactive,setShowInactive]=useState(false);
 const [analyticsLimit,setAnalyticsLimit]=useState(20);
 const [suggestionLimit,setSuggestionLimit]=useState(12);
 useEffect(()=>{
  let live=true;
  void chrome.storage.local.get(SETTINGS_KEY).then(value=>{
   if(live)setPrefs(normalizeCenterPrefs(value[SETTINGS_KEY],catalog));
  }).catch(e=>{if(live)setMessage(String(e));});
  const changed=(changes:{[key:string]:chrome.storage.StorageChange},area:string)=>{
   if(area==="local"&&changes[SETTINGS_KEY]&&live)
    setPrefs(normalizeCenterPrefs(changes[SETTINGS_KEY].newValue,catalog));
  };
  chrome.storage.onChanged.addListener(changed);
  return ()=>{live=false;chrome.storage.onChanged.removeListener(changed);};
 },[catalog.revision]);
 useEffect(()=>{
  let live=true;
  function load(){
   void centerRequest({type:"CENTER_ANALYTICS_GET"}).then(r=>{
    if(live&&r.ok&&"analytics" in r)setAnalytics(r.analytics);
   }).catch(e=>{if(live)setMessage(String(e));});
  }
  load();
  const listener=(msg:unknown)=>{
   if(msg&&typeof msg==="object"&&"type" in msg&&
      (msg.type==="SMART_UPDATED"||msg.type==="CATALOG_CHANGED"))load();
   return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  return ()=>{live=false;chrome.runtime.onMessage.removeListener(listener);};
 },[catalog.revision]);
 useEffect(()=>{
  let live=true;
  function getConfig(){
   void centerRequest({type:"CENTER_NOTIFICATION_GET"}).then(r=>{
    if(live&&r.ok&&"notifications" in r)setNotify(r.notifications);
   }).catch(e=>{if(live)setMessage(String(e));});
  }
  getConfig();
  const changed=(changes:{[key:string]:chrome.storage.StorageChange},area:string)=>{
   if(area==="local"&&changes.centerNotificationsV1)getConfig();
  };
  chrome.storage.onChanged.addListener(changed);
  return ()=>{live=false;chrome.storage.onChanged.removeListener(changed);};
 },[]);
 const groups=orderedGroups(catalog,prefs).map(id=>catalog.groups.find(g=>g.id===id)).filter(g=>g!==undefined);
 const pinned=new Set(prefs.pinnedGroupIds);
 const counted=useMemo(()=>{
  const map=new Map<string,{videos:SmartVideo[];unread:number;members:number}>();
  for(const group of catalog.groups){
   const ids=channelsInGroup(catalog,group.id);
   const videos=(feed?.videos??[]).filter(v=>ids.has(v.channelId));
   map.set(group.id,{videos,unread:videos.filter(v=>v.unread).length,members:ids.size});
  }
  return map;
 },[catalog,feed]);
 function persistPrefs(next:CenterPreferences){
  const clean=normalizeCenterPrefs(next,catalog);setPrefs(clean);
  void chrome.storage.local.set({[SETTINGS_KEY]:clean}).catch(e=>setMessage(String(e)));
 }
 function togglePin(id:string){
  persistPrefs({...prefs,pinnedGroupIds:pinned.has(id)?prefs.pinnedGroupIds.filter(x=>x!==id):[...prefs.pinnedGroupIds,id]});
 }
 function movePin(id:string,delta:number){
  const arr=[...prefs.pinnedGroupIds],index=arr.indexOf(id),target=index+delta;
  if(index<0||target<0||target>=arr.length)return;
  [arr[index],arr[target]]=[arr[target]!,arr[index]!];
  persistPrefs({...prefs,pinnedGroupIds:arr});
 }
 async function configureNotifications(enabled:boolean,ids:string[]){
  setBusy(true);setMessage("");
  try{
   if(enabled&&!ids.length)throw new Error("Bildirim almak için en az bir grup seçin.");
   if(enabled&&!notify?.enabled){
    // Request optional permission directly from the user's click.
    const granted=await chrome.permissions.request({permissions:["notifications"]});
    if(!granted)throw new Error("Chrome bildirim izni verilmedi.");
   }
   const r=await centerRequest({type:"CENTER_NOTIFICATION_CONFIGURE",enabled,groupIds:ids});
   if(r.ok&&"notifications" in r)setNotify(r.notifications);
   setMessage(enabled?"Grup bildirimleri etkin. Yeni videolar saatlik kontrollerde bildirilir.":"Bildirim tercihleri kaydedildi.");
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 }
 async function accept(channelId:string,groupId:string){
  setBusy(true);setMessage("");
  try{
   await send({type:"MEMBERSHIP_SET",channelIds:[channelId],groupId,enabled:true});
   setMessage("Kanal seçilen gruba eklendi.");
   const result=await centerRequest({type:"CENTER_ANALYTICS_GET"});
   if(result.ok&&"analytics" in result)setAnalytics(result.analytics);
  }catch(e){setMessage(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 }
 const candidates=(analytics?.channels??[]).filter(c=>{
  if(!showInactive)return !c.sourceAvailable;
  return c.sourceAvailable&&c.newestVideoAt&&Date.now()-Date.parse(c.newestVideoAt)>90*86400000;
 });
 return <section className="center-workspace">
  <div className="videos-heading">
   <div><span className="eyebrow">TUBESHELF · KİŞİSEL YOUTUBE MERKEZİ</span>
    <h1>Benim YouTube merkezim</h1>
    <p>Öncelikli gruplarını, yeni videoları ve takip ettiğin kanalları tek ekrandan yönet.</p></div>
   <button className="video-refresh" disabled={feedBusy} onClick={()=>{void refresh(false);}}>
    {feedBusy?"⏳ Güncelleniyor…":"↻ Videoları kontrol et"}
   </button>
  </div>
  <div className="smart-stats">
   <button className="center-stat" onClick={onInbox}><strong>{feed?.unreadCount??"—"}</strong><span>Yeni videolar</span></button>
   <button className="center-stat" onClick={onQueue}><strong>{watchState.queue.length}</strong><span>İzleme kuyruğu</span></button>
   <div><strong>{catalog.groups.length}</strong><span>Gruplar</span></div>
   <div><strong>{analytics?.sampledChannels??"—"} / {analytics?.channels.length??catalog.channels.length}</strong><span>Kaynağı taranan kanallar</span></div>
  </div>
  {(message||feedError)&&<div className={feedError?"notice error":"notice"} role="status">{message||feedError}</div>}
  <details className="center-settings">
   <summary><strong><span aria-hidden="true">⚙</span> Panoyu özelleştir</strong></summary>
   <div className="center-options">
    <label>Sütun sayısı <select value={prefs.columns} onChange={e=>persistPrefs({...prefs,columns:Number(e.target.value) as 1|2|3})}>
     <option value={1}>1 sütun</option><option value={2}>2 sütun</option><option value={3}>3 sütun</option>
    </select></label>
    <label>Grup başına video <select value={prefs.videosPerGroup} onChange={e=>persistPrefs({...prefs,videosPerGroup:Number(e.target.value) as 3|6|9})}>
     <option value={3}>3 video</option><option value={6}>6 video</option><option value={9}>9 video</option>
    </select></label>
    <label className="small-check"><input type="checkbox" checked={prefs.showUnpinned}
      onChange={e=>persistPrefs({...prefs,showUnpinned:e.target.checked})}/> Sabitlenmemiş grupları da göster</label>
   </div>
   <p>Grupların üstündeki ★ ile sabitleyebilir, oklarla sabit grupların sırasını değiştirebilirsin.</p>
  </details>
  <div className="center-group-grid" style={{gridTemplateColumns:"repeat("+prefs.columns+",minmax(0,1fr))"}}>
   {groups.map(group=>{
    const section=counted.get(group.id)??{videos:[],unread:0,members:0};
    const index=prefs.pinnedGroupIds.indexOf(group.id);
    return <section key={group.id} className="center-group">
     <div className="center-group-head">
      <button className="center-group-open" onClick={()=>onOpenGroup(group.id)}>{group.name} <span>↗</span></button>
      <div className="center-pin-controls">
       <button title={pinned.has(group.id)?"Sabitlemeyi kaldır":"Grubu sabitle"} aria-pressed={pinned.has(group.id)}
        onClick={()=>togglePin(group.id)}>{pinned.has(group.id)?"★":"☆"}</button>
       {pinned.has(group.id)&&<>
        <button title="Öne taşı" disabled={index<=0} onClick={()=>movePin(group.id,-1)}>↑</button>
        <button title="Sona taşı" disabled={index===prefs.pinnedGroupIds.length-1} onClick={()=>movePin(group.id,1)}>↓</button>
       </>}
      </div>
     </div>
     <p className="center-group-summary">{section.members} kanal · {section.unread} yeni · {section.videos.length} erişilebilir video</p>
     {section.videos.length?section.videos.slice(0,prefs.videosPerGroup).map(v=><GroupVideo key={v.id} video={v}/>):
      <p className="center-empty">Bu grupta henüz video yok. Akışını yenileyebilirsin.</p>}
    </section>;
   })}
   {!groups.length&&<p className="center-empty">Gösterilecek sabitlenmiş grup yok. Panoyu özelleştir bölümünden diğer grupları gösterebilir veya grup sabitleyebilirsin.</p>}
  </div>
  <div className="center-lower">
   <section className="center-surface">
    <h2><span aria-hidden="true">✧</span> Grup önerileri</h2>
    <p className="center-intro">Kanal adı ve önbellekteki video başlıklarına dayalı yerel öneriler. Değişiklik ancak onayladığında yapılır.</p>
    {analytics?.suggestions.length?<>
     {analytics.suggestions.slice(0,suggestionLimit).map(item=><div className="center-suggestion" key={item.channelId+":"+item.groupId}>
      <span><strong>{item.channelTitle}</strong><small>→ {item.groupName} · {item.explanation}</small></span>
      <button disabled={busy} onClick={()=>{void accept(item.channelId,item.groupId);}}>Gruba ekle</button>
     </div>)}
     {analytics.suggestions.length>suggestionLimit&&<button className="load-more"
      onClick={()=>setSuggestionLimit(n=>n+12)}>Diğer öneriler</button>}
    </>:<p className="center-empty">Şu anda yeterince güçlü grup önerisi bulunamadı.</p>}
   </section>
   <section className="center-surface">
    <h2><span aria-hidden="true">▥</span> Kanal etkinlik analizi</h2>
    <p className="center-intro">Son 30 gündeki yayın sayıları yalnızca yerel video önbelleğinin kapsadığı yayınlar üzerinden hesaplanır.</p>
    <div className="center-options">
     <button className={!showInactive?"center-selected":""} onClick={()=>{setShowInactive(false);setAnalyticsLimit(20);}}>Henüz taranamayanlar ({analytics?.missingSources??"—"})</button>
     <button className={showInactive?"center-selected":""} onClick={()=>{setShowInactive(true);setAnalyticsLimit(20);}}>90+ gün önce yayın görülenler</button>
    </div>
    {candidates.slice(0,analyticsLimit).map(ch=><div className="center-activity" key={ch.channelId}>
     <strong>{ch.title}</strong>
     <small>{!ch.sourceAvailable?"Kaynak henüz doğrulanmadı":ch.newestVideoAt?
      "Önbellekteki son yayın: "+formatVideoDate(ch.newestVideoAt):
      "Kaynakta tarihli video bulunamadı"}</small>
     {ch.sourceError&&<small className="center-source-error">Kaynak uyarısı: {ch.sourceError}</small>}
    </div>)}
    {!candidates.length&&<p className="center-empty">Bu kategoride kanal bulunamadı.</p>}
    {candidates.length>analyticsLimit&&<button className="load-more" onClick={()=>setAnalyticsLimit(n=>n+20)}>Daha fazla göster</button>}
   </section>
  </div>
  <section className="center-surface center-notifications">
   <h2><span aria-hidden="true">♢</span> Grup bildirimleri</h2>
   <p className="center-intro">Yalnızca seçtiğin gruplarda yeni yayınlar keşfedildiğinde, tarayıcı açıkken saatte bir kontrol sonrası grup başına tek özet bildirimi.</p>
   <div className="center-notification-actions">
    <button disabled={busy||!notify} onClick={()=>{
     if(notify)void configureNotifications(!notify.enabled,notify.groupIds);
    }}>{notify?.enabled?"Bildirimleri kapat":"Bildirimleri etkinleştir"}</button>
    <span>{notify?.enabled?"Bildirimler etkin":"Bildirimler kapalı"} · {notify?.groupIds.length??0} seçili grup</span>
   </div>
   <div className="center-notification-groups">
    {catalog.groups.map(g=><label key={g.id}><input type="checkbox"
      checked={notify?.groupIds.includes(g.id)??false} disabled={busy||!notify}
      onChange={e=>{
       if(!notify)return;
       const ids=e.target.checked?[...notify.groupIds,g.id]:notify.groupIds.filter(id=>id!==g.id);
       void configureNotifications(notify.enabled,ids);
      }}/>{g.name}</label>)}
   </div>
   <p className="center-disclaimer">Bildirimler varsayılan olarak kapalıdır. Chrome bildirimi izni gerekir. Mevcut videolar için ilk etkinleştirmede toplu bildirim üretilmez; tarayıcı kapalıyken kesin zamanlama garanti edilmez.</p>
  </section>
  <p className="center-disclaimer">Etkinlik analizi tüm YouTube arşivi değildir. Öneriler makine öğrenmesi modeliyle değil, açıklanabilir kelime eşleştirmesiyle hesaplanır.</p>
 </section>;
}
