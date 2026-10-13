import {useState} from "react";
import {Sidebar} from "./Sidebar";
import {Workspace} from "./Workspace";
import {useCatalog} from "./useCatalog";
export function App(){
 const s=useCatalog();
 const [active,setActive]=useState<string|null>(new URLSearchParams(location.hash.slice(1)).get("group"));
 const c=s.catalog;
 const current=c?.groups.some(g=>g.id===active)?active:null;
 function choose(id:string|null){
  setActive(id);s.setSelected(new Set());
  history.replaceState(null,"",id?"#group="+encodeURIComponent(id):location.pathname);
 }
 if(!c)return <main className="loading"><strong>TubeShelf</strong><p>{s.notice||"Kütüphane yükleniyor…"}</p></main>;
 return <div className="app-shell">
  <Sidebar catalog={c} active={current} onSelect={choose}
   onCreate={(name,parentId)=>{
    const existing=new Set(c.groups.map(g=>g.id));
    void s.run({type:"GROUP_CREATE",name,parentId},"Grup oluşturuldu.").then(next=>{
     const added=next?.groups.find(g=>!existing.has(g.id));if(added)choose(added.id);
    });
   }}
   onRename={(id,name)=>{void s.run({type:"GROUP_RENAME",id,name});}}
   onDelete={id=>{void s.run({type:"GROUP_DELETE",id}).then(next=>{if(next&&current===id)choose(null);});}}
   onMoveGroup={(id,parentId)=>{void s.run({type:"GROUP_MOVE",id,parentId},"Grup taşındı.");}}
   onDropChannel={(groupId,channelId)=>{
    void s.run({type:"MEMBERSHIP_SET",groupId,channelIds:[channelId],enabled:true},"Kanal gruba eklendi.");
   }}
  />
  <Workspace state={s} current={current} choose={choose}/>
 </div>;
}
