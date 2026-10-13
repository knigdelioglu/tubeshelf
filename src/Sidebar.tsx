import {useEffect,useMemo,useState} from "react";
import type {Catalog,Group} from "./types";
import {groupChannelCounts} from "./groups";
import {useWatchState} from "./useWatchState";
import type {SmartFeed} from "./smart-types";
interface Props {
 catalog:Catalog; active:string|null;view:"inbox"|"feed"|"board"|"manage"|"queue"; onSelect:(id:string|null)=>void;
 onInbox:()=>void;onQueue:()=>void;onBoard:()=>void;onFeed:()=>void;onManage:()=>void;
 onCreate:(name:string,parentId:string|null)=>void;
 onRename:(id:string,name:string)=>void; onDelete:(id:string)=>void;
 onDropChannel:(groupId:string,channelId:string)=>void;
 onMoveGroup:(id:string,parentId:string|null)=>void;
}
export function Sidebar({catalog,active,view,onSelect,onInbox,onQueue,onBoard,onFeed,onManage,onCreate,onRename,onDelete,onDropChannel,onMoveGroup}:Props){
 const [name,setName]=useState(""),[asRoot,setAsRoot]=useState(false);
 const counts=useMemo(()=>groupChannelCounts(catalog),[catalog]);
 const {state:watchState}=useWatchState();
 const [cachedFeed,setCachedFeed]=useState<SmartFeed|null>(null);
 useEffect(()=>{
  let active=true;
  function refresh(){
   void chrome.runtime.sendMessage({type:"SMART_FEED_GET",groupId:null}).then((result:unknown)=>{
    const response=result as {ok:boolean;feed?:SmartFeed};
    if(active&&response.ok&&response.feed)setCachedFeed(response.feed);
   }).catch(()=>undefined);
  }
  refresh();
  const listener=(raw:unknown)=>{
   if(raw&&typeof raw==="object"&&"type" in raw&&raw.type==="SMART_UPDATED")refresh();
   return false;
  };
  chrome.runtime.onMessage.addListener(listener);
  return ()=>{active=false;chrome.runtime.onMessage.removeListener(listener);};
 },[catalog.revision]);
 const unreadByGroup=useMemo(()=>{
  const counts=new Map<string,number>();
  const relations=new Map<string,string[]>();
  const byId=new Map(catalog.groups.map(g=>[g.id,g]));
  for(const m of catalog.memberships){
   const groups=relations.get(m.channelId)??[];
   groups.push(m.groupId);relations.set(m.channelId,groups);
  }
  for(const video of cachedFeed?.videos??[]){
   if(!video.unread)continue;
   const seen=new Set<string>();
   for(const id of relations.get(video.channelId)??[]){
    let current:string|null=id;
    while(current&&!seen.has(current)){
     seen.add(current);current=byId.get(current)?.parentId??null;
    }
   }
   for(const id of seen)counts.set(id,(counts.get(id)??0)+1);
  }
  return counts;
 },[catalog.groups,catalog.memberships,cachedFeed]);
 function create(e:React.FormEvent){
  e.preventDefault();if(!name.trim())return;
  onCreate(name,asRoot?null:active);setName("");
 }
 function groupRow(g:Group,depth:number):React.ReactNode{
  return <div key={g.id}>
   <div className={"group-row "+(active===g.id?"active":"")} style={{paddingLeft:8+depth*15}}
     onDragOver={e=>{if(e.dataTransfer.types.includes("application/x-tubeshelf-channel")||e.dataTransfer.types.includes("application/x-tubeshelf-group"))e.preventDefault();}}
     onDrop={e=>{
      e.preventDefault();
      const moved=e.dataTransfer.getData("application/x-tubeshelf-group");
      if(moved){onMoveGroup(moved,g.id);return;}
      const id=e.dataTransfer.getData("application/x-tubeshelf-channel");
      if(id)onDropChannel(g.id,id);
     }}>
    <span className="group-drag-handle" draggable title="Grubu başka gruba sürükle"
      onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData("application/x-tubeshelf-group",g.id);e.dataTransfer.effectAllowed="move";}}>⠿</span>
    <button className="group-button" onClick={()=>onSelect(g.id)} title={g.name}>
     <span aria-hidden="true">▱</span><span className="ellipsis">{g.name}</span>
     <small>{counts.get(g.id)??0}</small>
     {(unreadByGroup.get(g.id)??0)>0&&<span className="unread-pill" title="Önbellekteki yeni video">{unreadByGroup.get(g.id)}</span>}
    </button>
    {active===g.id&&<span className="group-actions">
     <button title="Yeniden adlandır" aria-label="Yeniden adlandır" onClick={()=>{const next=prompt("Yeni grup adı",g.name);if(next!==null)onRename(g.id,next);}}>✎</button>
     <button title="Grubu sil" aria-label="Grubu sil" onClick={()=>{if(confirm("Bu grup silinsin mi? Kanallar silinmez, alt gruplar korunur."))onDelete(g.id);}}>×</button>
    </span>}
   </div>
   {catalog.groups.filter(item=>item.parentId===g.id).map(child=>groupRow(child,depth+1))}
  </div>;
 }
 return <aside className="sidebar">
  <div className="brand"><div className="brand-mark">▶</div><div><strong>TubeShelf</strong><small>Abonelik yöneticisi</small></div></div>
  <div className="nav-label">KÜTÜPHANE</div>
  <button className={"all-button "+(view==="inbox"?"active":"")} onClick={onInbox}>
   ◉ <span>Yeni videolar</span>{Boolean(cachedFeed?.unreadCount)&&<span className="unread-pill">{cachedFeed?.unreadCount}</span>}
  </button>
  <button className={"all-button "+(view==="queue"?"active":"")} onClick={onQueue}>▶ <span>İzleme kuyruğu</span><small>{watchState.queue.length}</small></button>
  <button className={"all-button "+(view==="board"?"active":"")} onClick={onBoard}>▦ <span>Video panosu</span></button>
  <button className={"all-button "+(view==="feed"&&active===null?"active":"")} onClick={onFeed}>▶ <span>Tüm video akışı</span></button>
  <button className={"all-button "+(view==="manage"&&active===null?"active":"")} onClick={onManage}>◫ <span>Kanal yönetimi</span><small>{catalog.channels.length}</small></button>
  <div className="nav-label with-gap group-root-drop"
   onDragOver={e=>{if(e.dataTransfer.types.includes("application/x-tubeshelf-group"))e.preventDefault();}}
   onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData("application/x-tubeshelf-group");if(id)onMoveGroup(id,null);}}>
    GRUPLAR · ÜST DÜZEYE TAŞIMAK İÇİN BIRAK
   </div>
  <nav className="groups" aria-label="Abonelik grupları">
   {catalog.groups.filter(g=>g.parentId===null).map(g=>groupRow(g,0))}
   {!catalog.groups.length&&<div className="empty-sidebar">Henüz grup oluşturulmadı.</div>}
  </nav>
  <form className="create-form" onSubmit={create}>
   <label htmlFor="new-group">Yeni {active&&!asRoot?"alt grup":"grup"}</label>
   <div className="create-row"><input id="new-group" maxLength={80} placeholder="Grup adı" value={name} onChange={e=>setName(e.target.value)}/><button type="submit" title="Grup oluştur" disabled={!name.trim()}>+</button></div>
   {active&&<label className="small-check"><input type="checkbox" checked={asRoot} onChange={e=>setAsRoot(e.target.checked)}/> Üst düzey grup oluştur</label>}
  </form>
 </aside>;
}
