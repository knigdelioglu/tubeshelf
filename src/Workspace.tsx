import {useMemo,useState} from "react";
import {Toolbar} from "./Toolbar";
import {ChannelList} from "./ChannelList";
import {channelsInGroup} from "./groups";
import type {useCatalog} from "./useCatalog";
interface Props {state:ReturnType<typeof useCatalog>;current:string|null;choose:(id:string|null)=>void}
export function Workspace({state:s,current,choose}:Props){
 const c=s.catalog!;
 const [query,setQuery]=useState(""),[showInactive,setShowInactive]=useState(false),[limit,setLimit]=useState(200);
 const filtered=useMemo(()=>{
  const groupIds=current?channelsInGroup(c,current):null;
  return c.channels.filter(ch=>(showInactive||ch.subscribed)&&(!groupIds||groupIds.has(ch.id))&&ch.title.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr")))
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
   busy={s.busy} notice={s.notice} error={s.error} lastSync={c.lastSyncedAt}
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
