import {readCatalog} from "./db";
import {getAllVideoCaches} from "./video-db";
import {channelsInGroup} from "./groups";
import {smartAction} from "./smart-service";
import {analyzeChannels,eligibleNotificationVideos,normalizeNotifications} from "./center-domain";
import type {CenterRequest,CenterResponse,GroupNotificationConfig} from "./center-types";
import type {SmartVideo} from "./smart-types";

const STORAGE_KEY="centerNotificationsV1";
const ICON="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAABBklEQVR42u2YyRHCMBDAgKGOdJH0/3YX0Aj0AHtoE/mfhzRy7PX9te+f24XX43bxpQAFKEABClCAAhSgAAUoQAHha1vLAugSSrbAthZWROk/gCih/CdIq6HtFKBIaD0GCTUg7gGdEjAXoa4acDfBagnIq3ClBOwsULUl8MNQtoQR02BmDaPG4QwJ494DomsY+yASJWH0i1BEDad4EvtHwikEvI/j52+fVwUfX0AE/MgCosBHFhANP6aADPAxBWTCowvIBkcXUAWPFFAJj9oC1eCoArrg2wvoBG8vgADfUgAFvKUAGnxZAUTwsgLI8OkC6PDjxmEFKEABClCAAhSgAAUoQAFh6wv7J0lqnL5ghQAAAABJRU5ErkJggg==";
let serial:Promise<unknown>=Promise.resolve();
function exclusive<T>(job:()=>Promise<T>):Promise<T>{
 const promise=serial.then(job);serial=promise.then(()=>undefined,()=>undefined);return promise;
}
async function readConfig():Promise<GroupNotificationConfig>{
 const catalog=await readCatalog();
 const result=await chrome.storage.local.get(STORAGE_KEY);
 return normalizeNotifications(result[STORAGE_KEY],new Set(catalog.groups.map(g=>g.id)));
}
export async function centerAction(req:CenterRequest):Promise<CenterResponse>{
 try{
  switch(req.type){
   case "CENTER_ANALYTICS_GET":{
    const [catalog,caches]=await Promise.all([readCatalog(),getAllVideoCaches()]);
    return {ok:true,analytics:analyzeChannels(catalog,caches)};
   }
   case "CENTER_NOTIFICATION_GET":return {ok:true,notifications:await readConfig()};
   case "CENTER_NOTIFICATION_CONFIGURE":{
    return {ok:true,notifications:await exclusive(async()=>{
     if(typeof req.enabled!=="boolean"||!Array.isArray(req.groupIds)||req.groupIds.length>100||
       req.groupIds.some(id=>typeof id!=="string"))throw new Error("Geçersiz bildirim seçimi.");
     const catalog=await readCatalog();
     const known=new Set(catalog.groups.map(g=>g.id));
     const groups=[...new Set(req.groupIds)].filter(id=>known.has(id));
     if(req.enabled&&!await chrome.permissions.contains({permissions:["notifications"]})){
      throw new Error("Bildirimler için Chrome izni gerekli.");
     }
     const old=await readConfig();
     const feed=await smartAction({type:"SMART_FEED_GET",groupId:null});
     if(!feed.ok||!("feed" in feed))throw new Error("Bildirim başlangıç durumu okunamadı.");
     const seen:Record<string,string[]>={};
     for(const id of groups){
      if(old.enabled&&old.groupIds.includes(id)){seen[id]=old.seenIdsByGroup[id]??[];continue;}
      const members=channelsInGroup(catalog,id);
      seen[id]=feed.feed.videos.filter(v=>members.has(v.channelId)).map(v=>v.id).slice(0,1000);
     }
     const next:GroupNotificationConfig={enabled:req.enabled,groupIds:groups,
      enabledAt:!old.enabled&&req.enabled?new Date().toISOString():old.enabledAt,
      seenIdsByGroup:seen};
     await chrome.storage.local.set({[STORAGE_KEY]:next});
     return next;
    })};
   }
  }
 }catch(error){return {ok:false,error:error instanceof Error?error.message:String(error)};}
}

export async function checkGroupNotifications():Promise<number>{
 return exclusive(async()=>{
  const config=await readConfig();
  if(!config.enabled||config.groupIds.length===0)return 0;
  if(!await chrome.permissions.contains({permissions:["notifications"]}))return 0;
  const catalog=await readCatalog();
  const result=await smartAction({type:"SMART_FEED_GET",groupId:null});
  if(!result.ok||!("feed" in result))throw new Error("Video akışı alınamadı.");
  const feed=result.feed;
  let sent=0,dirty=false;
  for(const groupId of config.groupIds){
   const group=catalog.groups.find(g=>g.id===groupId);
   if(!group)continue;
   const members=channelsInGroup(catalog,groupId);
   const unseen=eligibleNotificationVideos(
    feed.videos.filter(v=>v.unread&&members.has(v.channelId)),
    config.enabledAt,config.seenIdsByGroup[groupId]??[]);
   if(!unseen.length)continue;
   const latest=unseen[0]!;
   const count=unseen.length;
   // A single digest per group, rather than a flood of video notifications.
   const id="tubeshelf-group:"+encodeURIComponent(groupId)+":"+Date.now();
   const message=count===1?latest.title:count+" yeni video · Son: "+latest.title;
   await chrome.notifications.create(id,{type:"basic",iconUrl:ICON,
    title:"TubeShelf · "+group.name,message:message.slice(0,250),priority:0});
   const ids=new Set([...(config.seenIdsByGroup[groupId]??[]),...unseen.map(v=>v.id)]);
   config.seenIdsByGroup[groupId]=[...ids].slice(-1000);
   dirty=true;sent++;
  }
  if(dirty)await chrome.storage.local.set({[STORAGE_KEY]:config});
  return sent;
 });
}
