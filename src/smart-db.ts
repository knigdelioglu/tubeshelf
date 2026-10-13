import {connect} from "./db";
import type {SmartState} from "./smart-types";
const KEYS=["inboxRead","mutedChannels","smartMeta"] as const;

export async function getSmartState():Promise<SmartState>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(KEYS,"readwrite");
  const reads=tx.objectStore("inboxRead").getAllKeys();
  const muted=tx.objectStore("mutedChannels").getAllKeys();
  const baseline=tx.objectStore("smartMeta").get("baseline");
  let value="";
  baseline.onsuccess=()=>{
   if(typeof baseline.result==="string"&&Number.isFinite(Date.parse(baseline.result)))value=baseline.result;
   else{
    value=new Date().toISOString();
    tx.objectStore("smartMeta").put(value,"baseline");
   }
  };
  tx.oncomplete=()=>{
   db.close();resolve({
    baseline:value,readIds:(reads.result as IDBValidKey[]).map(String),
    mutedChannelIds:(muted.result as IDBValidKey[]).map(String)
   });
  };
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Gelen kutusu okunamadı."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Gelen kutusu işlemi iptal edildi."));};
 });
}
export async function setReadState(videoIds:string[],read:boolean):Promise<number>{
 const ids=[...new Set(videoIds)];
 if(ids.length>25000)throw new Error("Toplu işaretleme sınırı aşıldı.");
 if(ids.length===0)return 0;
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("inboxRead","readwrite");
  const store=tx.objectStore("inboxRead");
  for(const id of ids)if(read)store.put(Date.now(),id);else store.delete(id);
  tx.oncomplete=()=>{db.close();resolve(ids.length);};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Okunma durumu kaydedilemedi."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Okunma kaydı iptal edildi."));};
 });
}
export async function setMuteState(channelId:string,muted:boolean):Promise<void>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("mutedChannels","readwrite");
  if(muted)tx.objectStore("mutedChannels").put(Date.now(),channelId);
  else tx.objectStore("mutedChannels").delete(channelId);
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Kanal sessize alınamadı."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Kanal ayarı iptal edildi."));};
 });
}
