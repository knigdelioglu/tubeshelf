import {useEffect,useState} from "react";
import {send} from "./client";
import {parseTakeoutCsv} from "./csv";
import type {Catalog,Request} from "./types";
import type {PersonalBackup,RestorePreview} from "./personal-backup-domain";
import type {PersonalBackupResponse,PersonalBackupRequest} from "./personal-backup-service";
async function backups(request:PersonalBackupRequest):Promise<PersonalBackupResponse>{
 const response=await chrome.runtime.sendMessage(request) as PersonalBackupResponse;
 if(!response?.ok)throw new Error(response?.error??"Yedekleme işlemi başarısız.");
 return response;
}
export function useCatalog(){
 const [catalog,setCatalog]=useState<Catalog|null>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(""),[error,setError]=useState(false);
 const [selected,setSelected]=useState<Set<string>>(new Set());
 useEffect(()=>{
  let live=true;
  const newer=(incoming:Catalog)=>{if(live)setCatalog(current=>!current||incoming.revision>=current.revision?incoming:current);};
  void send({type:"CATALOG_GET"}).then(newer).catch(e=>{if(live){setNotice(String(e));setError(true);}});
  const refresh=(message:unknown)=>{
   if(message&&typeof message==="object"&&"type" in message&&message.type==="CATALOG_CHANGED")
    void send({type:"CATALOG_GET"}).then(newer).catch(()=>undefined);
   return false;
  };
  chrome.runtime.onMessage.addListener(refresh);
  return ()=>{live=false;chrome.runtime.onMessage.removeListener(refresh);};
 },[]);
 async function run(request:Request,success="Değişiklikler kaydedildi."):Promise<Catalog|undefined>{
  setBusy(true);setError(false);setNotice("");
  try{
   const next=await send(request);setCatalog(current=>!current||next.revision>=current.revision?next:current);setSelected(new Set());setNotice(success);return next;
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:String(e));return undefined;}
  finally{setBusy(false);}
 }
 async function importCsv(file:File){
  try{const parsed=parseTakeoutCsv(await file.text());
   await run({type:"CATALOG_IMPORT",channels:parsed.channels},parsed.channels.length+" kanal içe aktarıldı ("+parsed.ignored+" satır atlandı).");
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:String(e));}
 }
 const MAX_BACKUP_BYTES=20*1024*1024;
 async function restore(file:File){
  if(file.size>MAX_BACKUP_BYTES){
   setError(true);setNotice("Yedek dosyası 20 MB sınırını aşıyor.");return;
  }
  setBusy(true);setError(false);setNotice("");
  try{
   const raw=JSON.parse(await file.text()) as unknown;
   const previewResponse=await backups({type:"FULL_BACKUP_PREVIEW",backup:raw});
   if(!("preview" in previewResponse))throw new Error("Yedek önizlemesi alınamadı.");
   const p:RestorePreview=previewResponse.preview;
   const message=p.format==="legacy"?
    "ESKİ GRUP YEDEĞİ\\n"+p.channels+" kanal · "+p.groups+" grup\\n"+
    "Grupların ve kanalların değişecek; kişisel izleme/kuyruk ayarların korunacak.\\n\\nDevam edilsin mi?":
    "TAM KİŞİSEL YEDEK\\n"+p.channels+" kanal · "+p.groups+" grup · "+p.queue+" kuyruk videosu\\n"+
    p.watched+" izlendi · "+p.read+" okundu · "+p.muted+" sessiz kanal\\n"+
    p.progress+" oynatma kaydı · "+p.filters+" filtre ayarı\\n\\n"+
    "Bu işlem mevcut TubeShelf verilerini değiştirecek. Video önbelleği sıfırlanır; Google oturumu ve izinler aktarılmaz. Önce mevcut düzenini yedekle.\\n\\nDevam edilsin mi?";
   if(!confirm(message))return;
   const response=await backups({type:"FULL_BACKUP_RESTORE",backup:raw});
   if(!("catalog" in response))throw new Error("Geri yükleme doğrulanamadı.");
   setCatalog(response.catalog);setSelected(new Set());
   setNotice(p.format==="legacy"?"Eski grup yedeği yüklendi; kişisel veriler korundu.":
    "Kişisel yedek geri yüklendi. Bildirimleri gerektiğinde yeniden etkinleştir.");
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 }
 async function backup(){
  setBusy(true);setError(false);setNotice("");
  try{
   const response=await backups({type:"FULL_BACKUP_CREATE"});
   if(!("backup" in response))throw new Error("Yedek oluşturulamadı.");
   const data:PersonalBackup=response.backup;
   const json=JSON.stringify(data,null,2);
   if(new Blob([json]).size>MAX_BACKUP_BYTES)throw new Error("Yedek 20 MB sınırını aşıyor. Lütfen destek isteyin.");
   const url=URL.createObjectURL(new Blob([json],{type:"application/json"}));
   const a=document.createElement("a");a.href=url;
   a.download="tubeshelf-tam-yedek-"+new Date().toISOString().slice(0,10)+".json";
   a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setNotice("Tam kişisel yedek dosyası hazırlandı.");
  }catch(e){setError(true);setNotice(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 }
 function toggle(id:string){setSelected(old=>{const next=new Set(old);if(next.has(id))next.delete(id);else next.add(id);return next;});}
 return {catalog,busy,notice,error,selected,setSelected,toggle,run,importCsv,restore,backup};
}
