import {channelUrl} from "./channel-ref";
import {useEffect,useMemo,useState} from "react";
import type {Catalog,Channel} from "./types";
interface Props {
 catalog:Catalog; channels:Channel[]; total:number; active:string|null;
 selected:Set<string>; busy:boolean; onToggle:(id:string)=>void;
 onToggleAll:()=>void; onAssign:(groupId:string,enabled:boolean)=>void;
 onMore:()=>void; canMore:boolean;
}
export function ChannelList({catalog,channels,total,active,selected,busy,onToggle,onToggleAll,onAssign,onMore,canMore}:Props){
 const [destination,setDestination]=useState(active??"");
 useEffect(()=>setDestination(active??""),[active]);
 const target=destination||catalog.groups[0]?.id||"";
 const {direct,membershipCounts}=useMemo(()=>{
  const direct=new Set<string>(),membershipCounts=new Map<string,number>();
  for(const m of catalog.memberships){
   if(m.groupId===active)direct.add(m.channelId);
   membershipCounts.set(m.channelId,(membershipCounts.get(m.channelId)??0)+1);
  }
  return {direct,membershipCounts};
 },[catalog.memberships,active]);
 return <section className="channel-panel">
  <div className="list-head"><div><h2>Kanallar</h2><p>{total} sonuç · {selected.size} seçili</p></div>
   <label className="select-all"><input type="checkbox" checked={channels.length>0&&channels.every(c=>selected.has(c.id))} onChange={onToggleAll}/> Görünenleri seç</label>
  </div>
  <div className="bulk-bar">
   <select aria-label="Hedef grup" value={target} onChange={e=>setDestination(e.target.value)} disabled={!catalog.groups.length}>
    {!catalog.groups.length&&<option value="">Önce grup oluşturun</option>}
    {catalog.groups.map(g=><option key={g.id} value={g.id}>{g.parentId?"↳ ":""}{g.name}</option>)}
   </select>
   <button disabled={busy||!selected.size||!target} onClick={()=>onAssign(target,true)}>+ Gruba ekle</button>
   <button className="ghost" disabled={busy||!selected.size||!target} onClick={()=>onAssign(target,false)}>Gruptan çıkar</button>
  </div>
  <div className="channel-rows">
   {!channels.length&&<div className="empty-state"><strong>Gösterilecek kanal yok</strong><p>YouTube\u0027dan kanalları getirin veya arama filtresini değiştirin.</p></div>}
   {channels.map(channel=><div className={"channel-row "+(selected.has(channel.id)?"selected":"")} key={channel.id}
    draggable onDragStart={e=>{e.dataTransfer.setData("application/x-tubeshelf-channel",channel.id);e.dataTransfer.effectAllowed="copy";}}>
    <input type="checkbox" aria-label={channel.title+" seç"} checked={selected.has(channel.id)} onChange={()=>onToggle(channel.id)}/>
    {channel.thumbnailUrl?<img className="avatar" src={channel.thumbnailUrl} alt=""/>:<span className="avatar avatar-fallback">{channel.title.charAt(0).toUpperCase()}</span>}
    <div className="channel-details"><a href={channelUrl(channel.id)} target="_blank" rel="noopener noreferrer">{channel.title} <span aria-hidden="true">↗</span></a>
     <small>{channel.subscribed?"Abone olundu":"Artık abone değil"} · {membershipCounts.get(channel.id)??0} grup{direct.has(channel.id)?" · Bu grupta":""}</small>
    </div>
    <span className="drag-hint" title="Bir gruba sürükleyin">⠿</span>
   </div>)}
  </div>
  {canMore&&<button className="load-more" onClick={onMore}>Daha fazla kanal göster</button>}
 </section>;
}
