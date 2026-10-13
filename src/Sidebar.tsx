import {useMemo,useState} from "react";
import type {Catalog,Group} from "./types";
import {groupChannelCounts} from "./groups";
interface Props {
 catalog:Catalog; active:string|null; onSelect:(id:string|null)=>void;
 onCreate:(name:string,parentId:string|null)=>void;
 onRename:(id:string,name:string)=>void; onDelete:(id:string)=>void;
 onDropChannel:(groupId:string,channelId:string)=>void;
 onMoveGroup:(id:string,parentId:string|null)=>void;
}
export function Sidebar({catalog,active,onSelect,onCreate,onRename,onDelete,onDropChannel,onMoveGroup}:Props){
 const [name,setName]=useState(""),[asRoot,setAsRoot]=useState(false);
 const counts=useMemo(()=>groupChannelCounts(catalog),[catalog]);
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
  <button className={"all-button "+(active===null?"active":"")} onClick={()=>onSelect(null)}>◫ <span>Tüm kanallar</span><small>{catalog.channels.length}</small></button>
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
