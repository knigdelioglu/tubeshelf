import type {Catalog,Request} from "./types";
import {readCatalog,writeCatalog} from "./db";
import {addGroup,renameGroup,deleteGroup,changed} from "./groups";
import {importChannels,setMembership} from "./channels";
import {validateBackup} from "./backup";
import {fetchSubscriptions} from "./youtube";
let queue:Promise<unknown>=Promise.resolve();
function serialized<T>(job:()=>Promise<T>):Promise<T>{
 const next=queue.then(job);
 queue=next.then(()=>undefined,()=>undefined);
 return next;
}
async function mutate(update:(c:Catalog)=>Catalog|Promise<Catalog>):Promise<Catalog>{
 return serialized(async()=>{
  const c=await readCatalog(),next=await update(c);
  await writeCatalog(next);
  const tabs=await chrome.tabs.query({url:"https://www.youtube.com/*"}).catch(()=>[]);
  for(const tab of tabs)if(tab.id)void chrome.tabs.sendMessage(tab.id,{type:"CATALOG_CHANGED"}).catch(()=>undefined);
  return next;
 });
}
export async function handle(message:Request):Promise<Catalog>{
 switch(message.type){
  case "CATALOG_GET":return readCatalog();
  case "OPEN_DASHBOARD":{
   await chrome.tabs.create({url:chrome.runtime.getURL("index.html")+(message.groupId?"#group="+encodeURIComponent(message.groupId):"")});
   return readCatalog();
  }
  case "CATALOG_IMPORT":
   if(!Array.isArray(message.channels))throw new Error("Geçersiz kanal listesi.");
   return mutate(c=>importChannels(c,message.channels));
  case "GROUP_CREATE":return mutate(c=>addGroup(c,crypto.randomUUID(),message.name,message.parentId));
  case "GROUP_RENAME":return mutate(c=>renameGroup(c,message.id,message.name));
  case "GROUP_DELETE":return mutate(c=>deleteGroup(c,message.id));
  case "MEMBERSHIP_SET":
   if(!Array.isArray(message.channelIds))throw new Error("Geçersiz kanal seçimi.");
   return mutate(c=>setMembership(c,message.groupId,message.channelIds,message.enabled));
  case "CATALOG_RESTORE":return mutate(c=>changed(validateBackup(message.backup),{revision:c.revision+1}));
  case "SUBSCRIPTIONS_SYNC":return mutate(async c=>importChannels(c,await fetchSubscriptions(),true));
  default:throw new Error("Bilinmeyen işlem.");
 }
}
