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
export async function putVideoCache(cache:ChannelVideoCache):Promise<void>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("feeds","readwrite");
  tx.objectStore("feeds").put(cache,cache.channelId);
  tx.oncomplete=()=>{db.close();resolve();};
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
