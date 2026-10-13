import {connect} from "./db";
import type {ChannelVideoCache} from "./video-types";

export async function getAllVideoCaches():Promise<ChannelVideoCache[]> {
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("feeds","readonly");
  const request=tx.objectStore("feeds").getAll();
  let result:ChannelVideoCache[]=[];
  request.onsuccess=()=>{result=request.result as ChannelVideoCache[];};
  tx.oncomplete=()=>{db.close();resolve(result);};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Video önbelleği okunamadı."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Video okuması iptal edildi."));};
 });
}
export async function putVideoCache(cache:ChannelVideoCache,expectedEpoch?:string):Promise<boolean>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(["feeds","smartMeta"],"readwrite");
  let accepted=false;
  if(expectedEpoch===undefined){tx.objectStore("feeds").put(cache,cache.channelId);accepted=true;}
  else {
   const epoch=tx.objectStore("smartMeta").get("videoCacheEpoch");
   epoch.onsuccess=()=>{
    const current=typeof epoch.result==="string"?epoch.result:"initial";
    if(current===expectedEpoch){tx.objectStore("feeds").put(cache,cache.channelId);accepted=true;}
   };
  }
  tx.oncomplete=()=>{db.close();resolve(accepted);};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Video önbelleği kaydedilemedi."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Video kaydı iptal edildi."));};
 });
}
export async function getWatchedVideoIds():Promise<string[]>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("watched","readonly");
  const request=tx.objectStore("watched").getAllKeys();
  let result:string[]=[];
  request.onsuccess=()=>{result=(request.result as IDBValidKey[]).map(String);};
  tx.oncomplete=()=>{db.close();resolve(result);};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("İzleme durumu okunamadı."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Okuma iptal edildi."));};
 });
}
export async function setWatched(id:string,watched:boolean):Promise<void>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("watched","readwrite");
  if(watched)tx.objectStore("watched").put(Date.now(),id);
  else tx.objectStore("watched").delete(id);
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("İzleme durumu kaydedilemedi."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("İzleme kaydı iptal edildi."));};
 });
}

/** An epoch changes when a complete personal backup is restored. Network requests
 * started in an older epoch must not repopulate cleared feeds. */
export async function readVideoCacheEpoch():Promise<string>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("smartMeta","readonly");
  const req=tx.objectStore("smartMeta").get("videoCacheEpoch");
  tx.oncomplete=()=>{db.close();resolve(typeof req.result==="string"?req.result:"initial");};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Önbellek sürümü okunamadı."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Önbellek sürümü okuması iptal edildi."));};
 });
}
