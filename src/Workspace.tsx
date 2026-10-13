import {useEffect,useMemo,useState} from "react";
import {Toolbar} from "./Toolbar";
import {ChannelList} from "./ChannelList";
import {channelsInGroup} from "./groups";
import type {useCatalog} from "./useCatalog";
import type {DirectImportStatus} from "./types";
interface Props {state:ReturnType<typeof useCatalog>;current:string|null;choose:(id:string|null)=>void}
export function Workspace({state:s,current,choose}:Props){
 const c=s.catalog!;
 const autoConfigured=Boolean(chrome.runtime.getManifest().oauth2?.client_id);
 const [autoSync,setAutoSync]=useState(false);
 const [directStatus,setDirectStatus]=useState<DirectImportStatus|undefined>();
 const [autoAuthorized,setAutoAuthorized]=useState(false);
 const [autoSyncError,setAutoSyncError]=useState("");
 const [preferenceError,setPreferenceError]=useState("");
 const [query,setQuery]=useState(""),[showInactive,setShowInactive]=useState(false),[limit,setLimit]=useState(200);
 useEffect(()=>{
  let active=true;
  void chrome.storage.local.get(["autoSyncEnabled","autoSyncAuthorized","lastAutoSyncError","directImportStatus"]).then(values=>{
   if(!active)return;
   setAutoSync(values.autoSyncEnabled===true);
   setDirectStatus(values.directImportStatus as DirectImportStatus|undefined);
   setAutoAuthorized(values.autoSyncAuthorized===true);
   setAutoSyncError(typeof values.lastAutoSyncError==="string"?values.lastAutoSyncError:"");
  }).catch(err=>{if(active)setPreferenceError(String(err));});
  const onStorage=(changes:{[key:string]:chrome.storage.StorageChange},area:string)=>{
   if(area!=="local")return;
   if(changes.autoSyncEnabled)setAutoSync(changes.autoSyncEnabled.newValue===true);
   if(changes.directImportStatus)setDirectStatus(changes.directImportStatus.newValue as DirectImportStatus|undefined);
   if(changes.autoSyncAuthorized)setAutoAuthorized(changes.autoSyncAuthorized.newValue===true);
   if(changes.lastAutoSyncError)setAutoSyncError(typeof changes.lastAutoSyncError.newValue==="string"?changes.lastAutoSyncError.newValue:"");
  };
  chrome.storage.onChanged.addListener(onStorage);
  return ()=>{active=false;chrome.storage.onChanged.removeListener(onStorage);};
 },[]);
 function updateAuto(enabled:boolean):void{
  void chrome.storage.local.set({autoSyncEnabled:enabled}).catch(err=>{
   setPreferenceError(err instanceof Error?err.message:String(err));
  });
 }
 const filtered=useMemo(()=>{
  const groupIds=current?channelsInGroup(c,current):null;
  const term=query.trim().toLocaleLowerCase("tr");
  return c.channels.filter(ch=>(showInactive||ch.subscribed)&&(!groupIds||groupIds.has(ch.id))&&ch.title.toLocaleLowerCase("tr").includes(term))
   .sort((a,b)=>a.title.localeCompare(b.title,"tr"));
 },[c,current,query,showInactive]);
 const shown=filtered.slice(0,limit);
 function toggleAll(){
  const all=shown.length>0&&shown.every(ch=>s.selected.has(ch.id));
  s.setSelected(old=>{
   const next=new Set(old);
   for(const ch of shown)if(all)next.delete(ch.id);else next.add(ch.id);
   return next;
  });
 }
 return <main className="main">
  <Toolbar total={c.channels.length} groups={c.groups.length} query={query} showInactive={showInactive}
   busy={s.busy} notice={preferenceError||s.notice} error={Boolean(preferenceError)||s.error} lastSync={c.lastSyncedAt}
   directStatus={directStatus} directImport={()=>{void s.run({type:"DIRECT_IMPORT_START"},"YouTube abonelikler sayfası açılıyor.");}}
   autoSync={autoSync} autoAuthorized={autoAuthorized} autoConfigured={autoConfigured}
   canEnableAuto={autoConfigured&&autoAuthorized} autoSyncError={autoSyncError} setAutoSync={updateAuto}
   search={value=>{setQuery(value);setLimit(200);}} toggleInactive={setShowInactive}
   importCsv={f=>{void s.importCsv(f);}} restore={f=>{void s.restore(f);}}
   backup={s.backup} sync={()=>{void s.run({type:"SUBSCRIPTIONS_SYNC"},"YouTube abonelikleri eşitlendi.");}}
  />
  {current&&<div className="current-group">Açık grup: <strong>{c.groups.find(g=>g.id===current)?.name}</strong><button onClick={()=>choose(null)}>Tümünü göster ×</button></div>}
  <ChannelList catalog={c} channels={shown} total={filtered.length} active={current}
   selected={s.selected} busy={s.busy} onToggle={s.toggle} onToggleAll={toggleAll}
   onAssign={(groupId,enabled)=>{
    void s.run({type:"MEMBERSHIP_SET",groupId,channelIds:[...s.selected],enabled},enabled?"Kanallar gruba eklendi.":"Kanallar gruptan çıkarıldı.");
   }}
   onMore={()=>setLimit(x=>x+200)} canMore={limit<filtered.length}
  />
 </main>;
}
