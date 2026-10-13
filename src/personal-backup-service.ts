import type {Catalog} from "./types";
import type {PersonalBackup,RestorePreview} from "./personal-backup-domain";
import {buildPersonalBackup,parsePersonalBackup} from "./personal-backup-domain";
import {readCatalog,connect} from "./db";
import {readPersonalSnapshot} from "./personal-snapshot-db";
import {normalizeCenterPrefs,normalizeNotifications} from "./center-domain";
import {validateFilter} from "./smart-domain";
import {handle,withCatalogLock} from "./service";

const DB_STORES=["catalog","feeds","watched","inboxRead","mutedChannels","smartMeta","watchQueue","playbackProgress"];
const SETTINGS=["centerPreferencesV1","centerNotificationsV1"] as const;
const ID=/^[A-Za-z0-9_-]{11}$/;
export type PersonalBackupRequest=
 | {type:"FULL_BACKUP_CREATE"}
 | {type:"FULL_BACKUP_PREVIEW";backup:unknown}
 | {type:"FULL_BACKUP_RESTORE";backup:unknown};
export type PersonalBackupResponse=
 | {ok:true;backup:PersonalBackup}
 | {ok:true;preview:RestorePreview}
 | {ok:true;catalog:Catalog}
 | {ok:false;error:string};

let serialized:Promise<unknown>=Promise.resolve();
function exclusive<T>(job:()=>Promise<T>):Promise<T>{
 const task=serialized.then(job);serialized=task.then(()=>undefined,()=>undefined);return task;
}
function notify(catalog:Catalog):void{
 void chrome.runtime.sendMessage({type:"CATALOG_CHANGED",revision:catalog.revision}).catch(()=>undefined);
 void chrome.runtime.sendMessage({type:"SMART_UPDATED"}).catch(()=>undefined);
 void chrome.runtime.sendMessage({type:"WATCH_UPDATED"}).catch(()=>undefined);
}
function personalSettings(values:Record<string,unknown>,catalog:Catalog){
 const filters:Record<string,ReturnType<typeof validateFilter>>={};
 for(const [key,val] of Object.entries(values)){
  if(key.startsWith("smartFilter:v1:"))filters[key]=validateFilter(val);
 }
 return {
  center:normalizeCenterPrefs(values.centerPreferencesV1,catalog),
  filters,
  notificationGroups:normalizeNotifications(values.centerNotificationsV1,
   new Set(catalog.groups.map(g=>g.id)))
 };
}
async function exportAll():Promise<PersonalBackup>{
 const [snapshot,settings]=await Promise.all([
  readPersonalSnapshot(),chrome.storage.local.get(null)
 ]);
 const preferences=personalSettings(settings,snapshot.catalog);
 const pack=buildPersonalBackup({
  catalog:snapshot.catalog,
  watchedVideoIds:snapshot.watchedVideoIds.filter(id=>ID.test(id)),
  readVideoIds:snapshot.readVideoIds.filter(id=>ID.test(id)),
  mutedChannelIds:snapshot.mutedChannelIds,
  inboxBaseline:snapshot.inboxBaseline,
  queue:snapshot.watch.queue,progress:snapshot.watch.progress,
  preferences
 });
 return parsePersonalBackup(pack).data; // Validate the exported file before offering it.
}

async function rewriteIndexedDb(data:PersonalBackup):Promise<void>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(DB_STORES,"readwrite");
  const done=(error:Error)=>{db.close();reject(error);};
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>done(tx.error??new Error("Veritabanı yazma hatası."));
  tx.onabort=()=>done(tx.error??new Error("Geri yükleme iptal edildi."));
  try{
   for(const name of DB_STORES)tx.objectStore(name).clear();
   tx.objectStore("catalog").put(data.catalog,"current");
   for(const id of data.watchedVideoIds)tx.objectStore("watched").put(Date.now(),id);
   for(const id of data.readVideoIds)tx.objectStore("inboxRead").put(Date.now(),id);
   for(const id of data.mutedChannelIds)tx.objectStore("mutedChannels").put(Date.now(),id);
   tx.objectStore("smartMeta").put(data.inboxBaseline,"baseline");
   tx.objectStore("smartMeta").put(crypto.randomUUID(),"videoCacheEpoch");
   tx.objectStore("watchQueue").put(data.queue,"current");
   for(const record of data.progress)tx.objectStore("playbackProgress").put(record,record.videoId);
  }catch(e){try{tx.abort();}catch{};done(e instanceof Error?e:new Error(String(e)));}
 });
}
async function settingsSnapshot():Promise<Record<string,unknown>>{
 const values=await chrome.storage.local.get(null);
 return Object.fromEntries(Object.entries(values).filter(([key])=>
  key.startsWith("smartFilter:v1:")||SETTINGS.includes(key as typeof SETTINGS[number])
 ));
}
async function applySettings(data:PersonalBackup,prior:Record<string,unknown>):Promise<void>{
 const oldKeys=Object.keys(prior).filter(key=>key.startsWith("smartFilter:v1:"));
 if(oldKeys.length)await chrome.storage.local.remove(oldKeys);
 await chrome.storage.local.set({
  centerPreferencesV1:data.preferences.center,
  ...data.preferences.filters,
  // Notification groups are portable, but granting/turning on browser notifications is not.
  centerNotificationsV1:{...data.preferences.notificationGroups,enabled:false}
 });
}
async function revertSettings(prior:Record<string,unknown>):Promise<void>{
 const current=await settingsSnapshot();
 const obsolete=Object.keys(current).filter(key=>!(key in prior));
 if(obsolete.length)await chrome.storage.local.remove(obsolete);
 if(Object.keys(prior).length)await chrome.storage.local.set(prior);
}
async function restoreAll(data:PersonalBackup):Promise<Catalog>{
 const current=await readCatalog();
 const next={...data,catalog:{
  ...data.catalog,revision:current.revision+1,updatedAt:new Date().toISOString()
 }};
 const old=await settingsSnapshot();
 try{
  // Chrome storage + IndexedDB cannot share a transaction. Stage settings and roll them
  // back if the atomic IndexedDB transaction fails.
  await applySettings(next,old);
  await rewriteIndexedDb(next);
 }catch(err){
  try{await revertSettings(old);}catch(rollbackError){
   throw new Error("Geri yükleme başarısız ve ayar geri alımı da tamamlanamadı: "+String(rollbackError));
  }
  throw err;
 }
 notify(next.catalog);
 return next.catalog;
}
export async function personalBackupAction(req:PersonalBackupRequest):Promise<PersonalBackupResponse>{
 try{
  switch(req.type){
   case "FULL_BACKUP_CREATE":return {ok:true,backup:await exclusive(exportAll)};
   case "FULL_BACKUP_PREVIEW":return {ok:true,preview:parsePersonalBackup(req.backup).preview};
   case "FULL_BACKUP_RESTORE":return exclusive(async()=>{
    const {data,preview}=parsePersonalBackup(req.backup);
    if(preview.format==="legacy"){
     // Crucial: legacy group backups must NOT erase modern watch history or settings.
     const catalog=await handle({type:"CATALOG_RESTORE",backup:data.catalog});
     return {ok:true,catalog};
    }
    return {ok:true,catalog:await withCatalogLock(()=>restoreAll(data))};
   });
  }
 }catch(err){return {ok:false,error:err instanceof Error?err.message:String(err)};}
}
