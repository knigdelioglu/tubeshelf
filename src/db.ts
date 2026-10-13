import type {Catalog} from "./types";
import {emptyCatalog} from "./groups";
const DB_NAME="tubeshelf", STORE="catalog";
export function connect():Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,2);
  req.onupgradeneeded=()=>{
   for(const store of [STORE,"feeds","watched"])if(!req.result.objectStoreNames.contains(store))req.result.createObjectStore(store);
  };
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error??new Error("Veritabanı açılamadı."));
 });
}
export async function readCatalog():Promise<Catalog>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readonly");
  const req=tx.objectStore(STORE).get("current");
  let value:Catalog|undefined;
  req.onsuccess=()=>{value=req.result as Catalog|undefined;};
  tx.oncomplete=()=>{db.close();resolve(value??emptyCatalog());};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Veri okunamadı."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Okuma iptal edildi."));};
 });
}
export async function writeCatalog(c:Catalog):Promise<void>{
 const db=await connect();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,"readwrite");
  tx.objectStore(STORE).put(c,"current");
  tx.oncomplete=()=>{db.close();resolve();};
  tx.onerror=()=>{db.close();reject(tx.error??new Error("Veri yazılamadı."));};
  tx.onabort=()=>{db.close();reject(tx.error??new Error("Yazma iptal edildi."));};
 });
}
