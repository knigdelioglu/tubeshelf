import type {Request,Response} from "./types";
import {handle} from "./service";
chrome.action.onClicked.addListener(()=>{
 void chrome.tabs.create({url:chrome.runtime.getURL("index.html")});
});
interface DirectMessage {type:string;token?:unknown;channels?:unknown}
async function directSession(sender:chrome.runtime.MessageSender,token?:string){
 const {directImportStatus}=await chrome.storage.local.get("directImportStatus");
 const session=directImportStatus as {state:string;token:string;tabId:number;startedAt:number;count:number}|undefined;
 if(!session||typeof sender.tab?.id!=="number"||session.tabId!==sender.tab.id||
    !["opening","scanning"].includes(session.state)||Date.now()-session.startedAt>160000)return null;
 if(token!==undefined&&token!==session.token)return null;
 return session;
}
chrome.runtime.onMessage.addListener((raw:unknown,sender,sendResponse:(response:unknown)=>void)=>{
 if(!raw||typeof raw!=="object"||!("type" in raw)||typeof raw.type!=="string"||raw.type==="CATALOG_CHANGED")return false;
 const message=raw as DirectMessage;
 if(message.type==="DIRECT_IMPORT_READY"){
  void directSession(sender).then(async session=>{
   if(!session){sendResponse({ok:false});return;}
   await chrome.storage.local.set({directImportStatus:{...session,state:"scanning"}});
   sendResponse({ok:true,session:{token:session.token,tabId:session.tabId,startedAt:session.startedAt}});
  }).catch(()=>sendResponse({ok:false}));
  return true;
 }
 if(message.type==="DIRECT_IMPORT_COMMIT"){
  void (async()=>{
   const session=await directSession(sender,typeof message.token==="string"?message.token:"");
   if(!session)throw new Error("Aktarım oturumu geçersiz veya zaman aşımına uğradı.");
   if(!Array.isArray(message.channels)||message.channels.length===0||message.channels.length>25000)
    throw new Error("YouTube kanal listesi geçersiz.");
   const catalog=await handle({type:"CATALOG_IMPORT",channels:message.channels});
   await chrome.storage.local.set({directImportStatus:{
    ...session,state:"done",count:message.channels.length
   }});
   sendResponse({ok:true,catalog});
  })().catch(err=>sendResponse({ok:false,error:err instanceof Error?err.message:String(err)}));
  return true;
 }
 handle(message as Request)
  .then(catalog=>sendResponse({ok:true,catalog} satisfies Response))
  .catch((error:unknown)=>sendResponse({ok:false,error:error instanceof Error?error.message:"Bilinmeyen hata."} satisfies Response));
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
