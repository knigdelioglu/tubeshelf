import type {Catalog,Request} from "./types";
import {readCatalog,writeCatalog} from "./db";
import {addGroup,renameGroup,deleteGroup,moveGroup,now} from "./groups";
import {importChannels,setMembership} from "./channels";
import {validateBackup} from "./backup";
import {fetchSubscriptions} from "./youtube";

let queue:Promise<unknown>=Promise.resolve();
function serialized<T>(job:()=>Promise<T>):Promise<T>{
 const next=queue.then(job);
 queue=next.then(()=>undefined,()=>undefined);
 return next;
}
function notify(c:Catalog):void {
 const message={type:"CATALOG_CHANGED",revision:c.revision};
 void chrome.runtime.sendMessage(message).catch(()=>undefined);
 void chrome.tabs.query({url:"https://www.youtube.com/*"}).then(tabs=>
  Promise.all(tabs.filter(tab=>typeof tab.id==="number").map(tab=>
   chrome.tabs.sendMessage(tab.id!,message).catch(()=>undefined)
  ))
 ).catch(()=>undefined);
}
async function mutate(update:(c:Catalog)=>Catalog|Promise<Catalog>):Promise<Catalog>{
 return serialized(async()=>{
  const current=await readCatalog();
  const next=await update(current);
  await writeCatalog(next);
  notify(next);
  return next;
 });
}
export async function handle(message:Request):Promise<Catalog>{
 switch(message.type){
  case "CATALOG_GET":return serialized(readCatalog);
  case "DIRECT_IMPORT_START":{
   const prior=(await chrome.storage.local.get("directImportStatus")).directImportStatus;
   if(prior&&["opening","scanning"].includes(prior.state)&&Date.now()-prior.startedAt<160000){
    throw new Error("YouTube abonelik aktarımı zaten devam ediyor.");
   }
   const tab=await chrome.tabs.create({url:"https://www.youtube.com/feed/channels",active:true});
   if(typeof tab.id!=="number")throw new Error("YouTube sekmesi açılamadı.");
   await chrome.storage.local.set({directImportStatus:{
    state:"opening",count:0,startedAt:Date.now(),tabId:tab.id,token:crypto.randomUUID()
   }});
   return serialized(readCatalog);
  }
  case "OPEN_DASHBOARD":{
   await chrome.tabs.create({url:chrome.runtime.getURL("index.html")+(message.groupId?"#group="+encodeURIComponent(message.groupId):"")});
   return serialized(readCatalog);
  }
  case "CATALOG_IMPORT":
   if(!Array.isArray(message.channels))throw new Error("Geçersiz kanal listesi.");
   return mutate(c=>importChannels(c,message.channels));
  case "GROUP_CREATE":return mutate(c=>addGroup(c,crypto.randomUUID(),message.name,message.parentId));
  case "GROUP_RENAME":return mutate(c=>renameGroup(c,message.id,message.name));
  case "GROUP_DELETE":return mutate(c=>deleteGroup(c,message.id));
  case "GROUP_MOVE":return mutate(c=>moveGroup(c,message.id,message.parentId));
  case "MEMBERSHIP_SET":
   if(!Array.isArray(message.channelIds))throw new Error("Geçersiz kanal seçimi.");
   return mutate(c=>setMembership(c,message.groupId,message.channelIds,message.enabled));
  case "CATALOG_RESTORE":return mutate(c=>({...validateBackup(message.backup),revision:c.revision+1,updatedAt:now()}));
  case "SUBSCRIPTIONS_SYNC":{
   const result=await mutate(async c=>importChannels(c,await fetchSubscriptions(true),true));
   await chrome.storage.local.set({autoSyncAuthorized:true});
   await chrome.storage.local.remove("lastAutoSyncError");
   return result;
  }
  case "SUBSCRIPTIONS_SYNC_AUTO":return mutate(async c=>importChannels(c,await fetchSubscriptions(false),true));
  default:throw new Error("Bilinmeyen işlem.");
 }
}
