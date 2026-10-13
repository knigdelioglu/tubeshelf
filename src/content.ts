import {scanSubscriptions} from "./direct-import";
import type {Catalog} from "./types";
import {channelsInGroup} from "./groups";
let host:HTMLElement|null=null, timer:number|undefined;
function button(text:string,onClick:()=>void):HTMLButtonElement{
 const el=document.createElement("button");el.textContent=text;el.addEventListener("click",onClick);return el;
}
function open(groupId?:string):void{
 void chrome.runtime.sendMessage({type:"OPEN_DASHBOARD",...(groupId?{groupId}:{})});
}
function target():Element|null{
 return document.querySelector("ytd-guide-renderer #sections")??document.querySelector("#guide-content #sections");
}
function mount():void{
 const parent=target();
 if(!parent)return;
 if(host?.parentElement===parent)return;
 host=document.createElement("div");
 host.id="tubeshelf-guide";
 const shadow=host.attachShadow({mode:"open"});
 const style=document.createElement("style");
 style.textContent=":host{display:block;font:14px Roboto,Arial,sans-serif;color:var(--yt-spec-text-primary,#eee);padding:10px 12px;border-bottom:1px solid var(--yt-spec-10-percent-layer,#555)}button{display:block;width:100%;padding:8px 10px;border:0;border-radius:9px;background:transparent;color:inherit;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}button:hover{background:var(--yt-spec-10-percent-layer,#444)}.top{font-weight:700;font-size:15px}.muted{opacity:.65;font-size:12px;padding-left:10px}";
 shadow.append(style);
 parent.prepend(host);
 void refresh();
}
async function refresh():Promise<void>{
 if(!host)return;
 try{
  const response=await chrome.runtime.sendMessage({type:"CATALOG_GET"}) as {ok:boolean;catalog?:Catalog};
  if(!response.ok||!response.catalog||!host)return;
  const shadow=host.shadowRoot;if(!shadow)return;
  shadow.querySelectorAll("button,.muted").forEach(x=>x.remove());
  shadow.append(button("▦  TubeShelf",()=>open()));
  shadow.lastElementChild?.classList.add("top");
  const groups=response.catalog.groups.slice(0,12);
  for(const group of groups){
   let level=0,parent=group.parentId;
   while(parent&&level<4){level++;parent=response.catalog.groups.find(g=>g.id===parent)?.parentId??null;}
   const count=channelsInGroup(response.catalog,group.id).size;
   const item=button("📁 "+group.name+" ("+count+")",()=>open(group.id));
   item.style.paddingLeft=String(10+level*13)+"px";
   shadow.append(item);
  }
  if(response.catalog.groups.length>12)shadow.append(button("Tüm grupları aç →",()=>open()));
  if(!groups.length){const note=document.createElement("div");note.textContent="Gruplarını oluşturmak için tıkla";note.className="muted";shadow.append(note);}
 }catch{/* Extension may be reloaded while YouTube stays open. */}
}
function schedule():void{
 if(timer!==undefined)return;
 timer=window.setTimeout(()=>{timer=undefined;mount();},400);
}
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener("yt-navigate-finish",schedule);
chrome.runtime.onMessage.addListener((message:unknown)=>{
 if(message&&typeof message==="object"&&"type" in message&&message.type==="CATALOG_CHANGED")void refresh();
 return false;
});
mount();

let directImportStarted=false;
async function beginDirectImport():Promise<void>{
 if(directImportStarted||location.pathname!=="/feed/channels")return;
 try{
  const response=await chrome.runtime.sendMessage({type:"DIRECT_IMPORT_READY"}) as
   {ok:boolean;session?:{token:string;tabId:number;startedAt:number}};
  if(!response.ok||!response.session)return;
  directImportStarted=true;
  await scanSubscriptions(response.session);
 }catch{/* A normal YouTube visit should never display extension errors. */}
}
window.setTimeout(()=>{void beginDirectImport();},900);
