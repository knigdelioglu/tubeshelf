import type {Request,Response} from "./types";
import {handle} from "./service";
chrome.action.onClicked.addListener(()=>{
 void chrome.tabs.create({url:chrome.runtime.getURL("index.html")});
});
chrome.runtime.onMessage.addListener((raw:unknown,_sender,sendResponse:(response:Response)=>void)=>{
 if(!raw||typeof raw!=="object"||!("type" in raw)||typeof raw.type!=="string"||raw.type==="CATALOG_CHANGED")return false;
 handle(raw as Request)
  .then(catalog=>sendResponse({ok:true,catalog}))
  .catch((error:unknown)=>sendResponse({ok:false,error:error instanceof Error?error.message:"Bilinmeyen hata."}));
 return true;
});

const AUTO_ALARM="tubeshelf-subscription-sync";
const SYNC_INTERVAL_MINUTES=12*60;

async function configureAutomaticSync():Promise<void>{
 const {autoSyncEnabled}=await chrome.storage.local.get("autoSyncEnabled");
 if(autoSyncEnabled===true&&Boolean(chrome.runtime.getManifest().oauth2?.client_id)){
  if(!await chrome.alarms.get(AUTO_ALARM)){
   await chrome.alarms.create(AUTO_ALARM,{periodInMinutes:SYNC_INTERVAL_MINUTES});
  }
 }else{
  await chrome.alarms.clear(AUTO_ALARM);
 }
}
chrome.runtime.onInstalled.addListener(()=>{void configureAutomaticSync();});
chrome.runtime.onStartup.addListener(()=>{void configureAutomaticSync();});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==="local"&&"autoSyncEnabled" in changes)void configureAutomaticSync();
});
chrome.alarms.onAlarm.addListener(alarm=>{
 if(alarm.name!==AUTO_ALARM)return;
 void (async()=>{
  const {autoSyncEnabled}=await chrome.storage.local.get("autoSyncEnabled");
  if(autoSyncEnabled!==true)return;
  await handle({type:"SUBSCRIPTIONS_SYNC_AUTO"});
  await chrome.storage.local.remove("lastAutoSyncError");
 })().catch(async error=>{
  await chrome.storage.local.set({lastAutoSyncError:error instanceof Error?error.message:"Otomatik eşitleme başarısız oldu."});
 });
});
// An alarm can be dropped during extension updates or browser restarts.
void configureAutomaticSync().catch(()=>undefined);
