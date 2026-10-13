import {useEffect,useState} from "react";
import {send} from "./client";
import {parseTakeoutCsv} from "./csv";
import type {Catalog,Request} from "./types";
export function useCatalog(){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState(false);
 const [selected,setSelected]=useState<Set<string>>(new Set());
 useEffect(()=>{void send({type:"CATALOG_GET"}).then(setCatalog).catch(e=>{setNotice(String(e));setError(true);});},[]);
 async function run(request:Request,success="Değişiklikler kaydedildi."):Promise<Catalog|undefined>{
  setBusy(true);setError(false);setNotice("");
  try{
   const next=await send(request);setCatalog(next);setSelected(new Set());setNotice(success);return next;
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:String(e));return undefined;}
  finally{setBusy(false);}
 }
 async function importCsv(file:File){
  try{const parsed=parseTakeoutCsv(await file.text());
   await run({type:"CATALOG_IMPORT",channels:parsed.channels},parsed.channels.length+" kanal içe aktarıldı ("+parsed.ignored+" satır atlandı).");
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:String(e));}
 }
 async function restore(file:File){
  if(!confirm("Mevcut yerel düzen, bu yedekle değiştirilsin mi? Önce yedek indirmeniz önerilir."))return;
  try{await run({type:"CATALOG_RESTORE",backup:JSON.parse(await file.text())},"Yedek geri yüklendi.");}
  catch(e){setError(true);setNotice(e instanceof Error?e.message:String(e));}
 }
 function backup(){
  if(!catalog)return;
  const data=JSON.stringify(catalog,null,2),url=URL.createObjectURL(new Blob([data],{type:"application/json"}));
  const a=document.createElement("a");a.href=url;a.download="tubeshelf-"+new Date().toISOString().slice(0,10)+".json";a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function toggle(id:string){setSelected(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});}
 return {catalog,busy,notice,error,selected,setSelected,toggle,run,importCsv,restore,backup};
}
