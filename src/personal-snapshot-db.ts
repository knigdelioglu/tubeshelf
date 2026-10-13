import {connect} from "./db";
import {emptyCatalog} from "./groups";
import type {Catalog} from "./types";
import type {WatchState} from "./watch-types";

export interface SnapshotData {
 catalog:Catalog;
 watch:WatchState;
 watchedVideoIds:string[];
 readVideoIds:string[];
 mutedChannelIds:string[];
 inboxBaseline:string;
}
/** Read personal records within one IndexedDB transaction. This avoids a torn
 * export where queue, progress and read/unread keys come from different moments. */
export async function readPersonalSnapshot():Promise<SnapshotData>{
 const db=await connect();
 const stores=["catalog","watched","inboxRead","mutedChannels","smartMeta","watchQueue","playbackProgress"];
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(stores,"readonly");
  const catalog=tx.objectStore("catalog").get("current");
  const watched=tx.objectStore("watched").getAllKeys();
  const read=tx.objectStore("inboxRead").getAllKeys();
  const muted=tx.objectStore("mutedChannels").getAllKeys();
  const baseline=tx.objectStore("smartMeta").get("baseline");
  const queue=tx.objectStore("watchQueue").get("current");
  const progress=tx.objectStore("playbackProgress").getAll();
  tx.oncomplete=()=>{
   db.close();
   resolve({
    catalog:(catalog.result as Catalog|undefined)??emptyCatalog(),
    watchedVideoIds:(watched.result as IDBValidKey[]).map(String),
    readVideoIds:(read.result as IDBValidKey[]).map(String),
    mutedChannelIds:(muted.result as IDBValidKey[]).map(String),
    inboxBaseline:typeof baseline.result==="string"?baseline.result:new Date().toISOString(),
    watch:{queue:Array.isArray(queue.result)?queue.result:[],
     progress:Array.isArray(progress.result)?progress.result:[]}
   });
  };
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Yedek kayıtları okunamadı."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Yedek okuması iptal edildi."));};
 });
}
