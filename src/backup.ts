import type {Catalog} from "./types";
import {CHANNEL_ID} from "./channels";
import {now} from "./groups";
export function validateBackup(raw:unknown):Catalog {
 if(!raw||typeof raw!=="object")throw new Error("Yedek biçimi geçersiz.");
 const x=raw as Partial<Catalog>;
 if(x.schemaVersion!==1||!Array.isArray(x.channels)||!Array.isArray(x.groups)||!Array.isArray(x.memberships))throw new Error("Desteklenmeyen ya da bozuk yedek.");
 if(x.channels.length>25000||x.groups.length>2000||x.memberships.length>100000)throw new Error("Yedek boyut sınırını aşıyor.");
 const channels=x.channels.map(v=>{
  if(!v||typeof v.id!=="string"||!CHANNEL_ID.test(v.id)||typeof v.title!=="string"||!v.title.trim()||v.title.length>300)throw new Error("Geçersiz kanal kaydı.");
  return {id:v.id,title:v.title.trim(),subscribed:v.subscribed===true,
   ...(typeof v.thumbnailUrl==="string"&&v.thumbnailUrl.startsWith("https://")?{thumbnailUrl:v.thumbnailUrl}:{}),
   ...(typeof v.lastSeenAt==="string"?{lastSeenAt:v.lastSeenAt}:{})};
 });
 const groups=x.groups.map(g=>{
  if(!g||typeof g.id!=="string"||!g.id||g.id.length>100||typeof g.name!=="string"||!g.name.trim()||g.name.length>80||(g.parentId!==null&&typeof g.parentId!=="string"))throw new Error("Geçersiz grup kaydı.");
  return {id:g.id,name:g.name.trim(),parentId:g.parentId,createdAt:typeof g.createdAt==="string"?g.createdAt:now()};
 });
 const cids=new Set(channels.map(c=>c.id)),gids=new Set(groups.map(g=>g.id));
 if(cids.size!==channels.length||gids.size!==groups.length)throw new Error("Yedekte tekrarlı kayıt var.");
 for(const g of groups){
  if(g.parentId&&!gids.has(g.parentId))throw new Error("Üst grup eksik.");
  const seen=new Set([g.id]);let parent=g.parentId;
  while(parent){if(seen.has(parent))throw new Error("Döngüsel grup yapısı.");seen.add(parent);parent=groups.find(v=>v.id===parent)?.parentId??null;}
 }
 const keys=new Set<string>();
 const memberships=x.memberships.map(m=>{
  if(!m||typeof m.groupId!=="string"||typeof m.channelId!=="string"||!gids.has(m.groupId)||!cids.has(m.channelId))throw new Error("Geçersiz üyelik.");
  const key=m.groupId+":"+m.channelId;if(keys.has(key))throw new Error("Tekrarlı üyelik.");keys.add(key);
  return {groupId:m.groupId,channelId:m.channelId};
 });
 return {schemaVersion:1,revision:Number.isSafeInteger(x.revision)&&Number(x.revision)>=0?x.revision!:0,
  updatedAt:now(),...(typeof x.lastSyncedAt==="string"?{lastSyncedAt:x.lastSyncedAt}:{}),channels,groups,memberships};
}
