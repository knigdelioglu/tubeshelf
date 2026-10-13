import {centerAction,checkGroupNotifications} from "./center-service";
import type {CenterRequest} from "./center-types";
import {watchAction} from "./watch-service";
import type {WatchRequest} from "./watch-types";
import {smartAction,announceSmartChange} from "./smart-service";
import type {SmartVideoRequest} from "./smart-types";
import {videoAction} from "./video-service";
import type {VideoRequest} from "./video-types";
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
 if(!raw||typeof raw!=="object"||!("type" in raw)||typeof raw.type!=="string"||raw.type==="CATALOG_CHANGED"||raw.type==="SMART_UPDATED"||raw.type==="WATCH_UPDATED")return false;
 if(raw.type==="CENTER_ANALYTICS_GET"||raw.type==="CENTER_NOTIFICATION_GET"||
    raw.type==="CENTER_NOTIFICATION_CONFIGURE"){
  void centerAction(raw as CenterRequest).then(sendResponse).catch(err=>
   sendResponse({ok:false,error:err instanceof Error?err.message:String(err)}));
  return true;
 }
 if(raw.type==="SMART_FEED_GET"||raw.type==="SMART_FEED_REFRESH"||
    raw.type==="SMART_READ_SET"||raw.type==="SMART_READ_ALL"||raw.type==="SMART_MUTE_SET"){
  void smartAction(raw as SmartVideoRequest).then(sendResponse).catch(err=>
   sendResponse({ok:false,error:err instanceof Error?err.message:String(err)}));
  return true;
 }
 if(raw.type==="VIDEO_GET"||raw.type==="VIDEO_REFRESH"||raw.type==="VIDEO_WATCHED_SET"){
  void videoAction(raw as VideoRequest).then(response=>{
   if(raw.type==="VIDEO_WATCHED_SET"&&response.ok)announceSmartChange();
   sendResponse(response);
  }).catch(err=>
   sendResponse({ok:false,error:err instanceof Error?err.message:String(err)}));
  return true;
 }
 if(raw.type==="WATCH_GET"||raw.type==="WATCH_QUEUE_ADD"||raw.type==="WATCH_QUEUE_REMOVE"||
    raw.type==="WATCH_QUEUE_MOVE"||raw.type==="WATCH_QUEUE_CLEAR"||
    raw.type==="WATCH_PROGRESS_SET"||raw.type==="WATCH_PROGRESS_RESET"||raw.type==="WATCH_COMPLETE"){
  void watchAction(raw as WatchRequest).then(response=>{
   if((raw.type==="WATCH_PROGRESS_SET"||raw.type==="WATCH_COMPLETE")&&response.ok&&
      response.state.progress.some((p:{videoId:string;completed:boolean})=>p.videoId===(raw as {videoId?:string}).videoId&&p.completed))announceSmartChange();
   sendResponse(response);
  }).catch(err=>sendResponse({ok:false,error:err instanceof Error?err.message:String(err)}));
  return true;
 }
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

const SMART_ALARM="tubeshelf-smart-refresh";
async function configureSmartRefresh():Promise<void>{
 const data=await chrome.storage.local.get(["smartAutoRefreshEnabled","centerNotificationsV1"]);
 const needsAlarm=data.smartAutoRefreshEnabled===true||data.centerNotificationsV1?.enabled===true;
 if(needsAlarm){
  if(!await chrome.alarms.get(SMART_ALARM))await chrome.alarms.create(SMART_ALARM,{periodInMinutes:60});
 }else await chrome.alarms.clear(SMART_ALARM);
}
chrome.runtime.onStartup.addListener(()=>{void configureSmartRefresh();});
chrome.runtime.onInstalled.addListener(()=>{void configureSmartRefresh();});
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area==="local"&&("smartAutoRefreshEnabled" in changes||"centerNotificationsV1" in changes))void configureSmartRefresh();
});
chrome.alarms.onAlarm.addListener(alarm=>{
 if(alarm.name!==SMART_ALARM)return;
 void (async()=>{
  const data=await chrome.storage.local.get(["smartAutoRefreshEnabled","centerNotificationsV1"]);
  if(data.smartAutoRefreshEnabled!==true&&data.centerNotificationsV1?.enabled!==true)return;
  const result=await smartAction({type:"SMART_FEED_REFRESH",groupId:null});
  if(!result.ok)throw new Error(result.error);
  if(data.centerNotificationsV1?.enabled===true)await checkGroupNotifications();
  await chrome.storage.local.remove("smartRefreshError");
 })().catch(async e=>{
  await chrome.storage.local.set({smartRefreshError:e instanceof Error?e.message:"Yenileme başarısız."});
 });
});
void configureSmartRefresh().catch(()=>undefined);

chrome.notifications.onClicked.addListener(id=>{
 if(!id.startsWith("tubeshelf-group:"))return;
 const groupId=id.slice("tubeshelf-group:".length).split(":")[0];
 if(!groupId)return;
 try{
  const decoded=decodeURIComponent(groupId);
  const params=new URLSearchParams({view:"feed",group:decoded});
  void chrome.tabs.create({url:chrome.runtime.getURL("index.html")+"#"+params.toString()});
 }catch{/* Invalid or stale notification identifiers are ignored. */}
});
