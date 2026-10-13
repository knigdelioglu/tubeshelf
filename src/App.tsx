import {useState} from "react";
import {Sidebar} from "./Sidebar";
import {Workspace} from "./Workspace";
import {useCatalog} from "./useCatalog";
export function App(){
 const s=useCatalog();
 const initial=new URLSearchParams(location.hash.slice(1));
 const [active,setActive]=useState<string|null>(initial.get("group"));
 const [view,setView]=useState<"inbox"|"feed"|"board"|"manage"|"queue">(
  ["inbox","feed","board","manage","queue"].includes(initial.get("view")??"")?initial.get("view") as "inbox"|"feed"|"board"|"manage"|"queue":"inbox"
 );
 const c=s.catalog;
 const current=c?.groups.some(g=>g.id===active)?active:null;
 function navigate(nextView:"inbox"|"feed"|"board"|"manage"|"queue",groupId:string|null=active){
  setActive(groupId);setView(nextView);s.setSelected(new Set());
  const params=new URLSearchParams({view:nextView});
  if(groupId)params.set("group",groupId);
  history.replaceState(null,"","#"+params.toString());
 }
 function choose(id:string|null){navigate(id?"feed":"manage",id);}
 if(!c)return <main className="loading"><strong>TubeShelf</strong><p>{s.notice||"Kütüphane yükleniyor…"}</p></main>;
 return <div className="app-shell">
  <Sidebar catalog={c} active={current} view={view}
   onSelect={choose} onInbox={()=>navigate("inbox",null)} onQueue={()=>navigate("queue",null)} onBoard={()=>navigate("board",null)}
   onFeed={()=>navigate("feed",null)} onManage={()=>navigate("manage",null)}
   onCreate={(name,parentId)=>{
    const existing=new Set(c.groups.map(g=>g.id));
    void s.run({type:"GROUP_CREATE",name,parentId},"Grup oluşturuldu.").then(next=>{
     const added=next?.groups.find(g=>!existing.has(g.id));if(added)navigate("manage",added.id);
    });
   }}
   onRename={(id,name)=>{void s.run({type:"GROUP_RENAME",id,name});}}
   onDelete={id=>{void s.run({type:"GROUP_DELETE",id}).then(next=>{if(next&&current===id)choose(null);});}}
   onMoveGroup={(id,parentId)=>{void s.run({type:"GROUP_MOVE",id,parentId},"Grup taşındı.");}}
   onDropChannel={(groupId,channelId)=>{
    void s.run({type:"MEMBERSHIP_SET",groupId,channelIds:[channelId],enabled:true},"Kanal gruba eklendi.");
   }}
  />
  <Workspace state={s} current={current} choose={choose} view={view} navigate={navigate}/>
 </div>;
}
