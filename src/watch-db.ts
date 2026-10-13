import {connect} from "./db";
import type {QueuedVideo,PlaybackProgress,WatchState} from "./watch-types";
export async function getWatchState():Promise<WatchState>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(["watchQueue","playbackProgress"],"readonly");
  const q=tx.objectStore("watchQueue").get("current");
  const p=tx.objectStore("playbackProgress").getAll();
  tx.oncomplete=()=>{
   db.close();resolve({queue:Array.isArray(q.result)?q.result as QueuedVideo[]:[],
    progress:Array.isArray(p.result)?p.result as PlaybackProgress[]:[]});
  };
  tx.onerror=()=>{db.close();reject(tx.error??new Error("İzleme verileri okunamadı."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("İzleme okuması iptal edildi."));};
 });
}
export async function writeQueue(queue:QueuedVideo[]):Promise<void>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("watchQueue","readwrite");
  tx.objectStore("watchQueue").put(queue,"current");
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Kuyruk kaydedilemedi."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Kuyruk yazma işlemi iptal edildi."));};
 });
}
export async function writeProgress(progress:PlaybackProgress|null,videoId:string):Promise<void>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction("playbackProgress","readwrite");
  if(progress)tx.objectStore("playbackProgress").put(progress,videoId);
  else tx.objectStore("playbackProgress").delete(videoId);
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("İlerleme kaydedilemedi."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("İlerleme yazma işlemi iptal edildi."));};
 });
}
