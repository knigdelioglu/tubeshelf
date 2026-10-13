import type {Catalog,Channel} from "./types";
import type {ChannelVideoCache,VideoFeedItem} from "./video-types";
import type {SmartFeed,SmartVideo,SmartVideoRequest,SmartVideoResponse} from "./smart-types";
import {readCatalog} from "./db";
import {getAllVideoCaches,getWatchedVideoIds,putVideoCache,readVideoCacheEpoch} from "./video-db";
import {globalFeedWork} from "./refresh-coordinator";
import {getSmartState,setMuteState,setReadState} from "./smart-db";
import {isUnread} from "./smart-domain";
import {channelsInGroup} from "./groups";
import {loadChannelVideos} from "./video-network";

const REFRESH_INTERVAL=30*60*1000;
const BATCH_LIMIT=12;
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;
const pending=new Map<string,Promise<SmartFeed>>();


function scopedChannels(c:Catalog,groupId:string|null,muted:Set<string>):Channel[]{
 if(groupId!==null&&!c.groups.some(g=>g.id===groupId))throw new Error("Grup bulunamadı.");
 const members=groupId===null?null:channelsInGroup(c,groupId);
 return c.channels.filter(ch=>ch.subscribed&&!muted.has(ch.id)&&(!members||members.has(ch.id)));
}
function retryDelay(cache:ChannelVideoCache):number{
 return Math.min(60*60*1000,2**Math.min(cache.consecutiveFailures??0,5)*60*1000);
}
function refreshNeeded(cache:ChannelVideoCache|undefined,force:boolean,time=Date.now()):boolean{
 if(!cache)return true;
 const lastAttempt=Date.parse(cache.attemptedAt??cache.updatedAt);
 if((cache.consecutiveFailures??0)>0&&Number.isFinite(lastAttempt)&&time-lastAttempt<retryDelay(cache))return false;
 const lastSuccess=Date.parse(cache.updatedAt);
 return force||!Number.isFinite(lastSuccess)||time-lastSuccess>=REFRESH_INTERVAL;
}
export function chooseRefreshChannels(
 channels:Channel[],records:Map<string,ChannelVideoCache>,force:boolean,time=Date.now()
):Channel[]{
 return channels.filter(ch=>refreshNeeded(records.get(ch.id),force,time)).sort((a,b)=>{
  const aa=records.get(a.id)?.attemptedAt??records.get(a.id)?.updatedAt??"";
  const bb=records.get(b.id)?.attemptedAt??records.get(b.id)?.updatedAt??"";
  return aa.localeCompare(bb);
 });
}
export function announceSmartChange():void{
 void chrome.runtime.sendMessage({type:"SMART_UPDATED"}).catch(()=>undefined);
}
async function snapshot(groupId:string|null,lastBatch?:{attempted:number;remaining:number}):Promise<SmartFeed>{
 const [catalog,caches,watchedIds,state]=await Promise.all([
  readCatalog(),getAllVideoCaches(),getWatchedVideoIds(),getSmartState()
 ]);
 const muted=new Set(state.mutedChannelIds);
 const channels=scopedChannels(catalog,groupId,muted);
 const allowed=new Set(channels.map(ch=>ch.id));
 const read=new Set(state.readIds),watched=new Set(watchedIds);
 const unique=new Map<string,SmartVideo>();
 let loaded=0,failed=0,updatedAt="";
 const errors:string[]=[];
 for(const cache of caches){
  if(!allowed.has(cache.channelId))continue;
  if(cache.updatedAt&&cache.updatedAt>updatedAt)updatedAt=cache.updatedAt;
  if(cache.error){failed++;if(errors.length<6)errors.push(cache.error);}
  if(cache.videos.length||!cache.error)loaded++;
  for(const item of cache.videos){
   const earlier=unique.get(item.id);
   if(earlier&&!(earlier.kind==="unknown"&&item.kind!=="unknown"))continue;
   const isWatched=watched.has(item.id),isRead=read.has(item.id);
   unique.set(item.id,{...item,watched:isWatched,read:isRead,
    unread:isUnread(item.publishedAt,state.baseline,isRead,isWatched)});
  }
 }
 const videos=[...unique.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,2500);
 const byChannel=new Map(caches.map(cache=>[cache.channelId,cache]));
 const pendingChannels=chooseRefreshChannels(channels,byChannel,false).length;
 return {videos,unreadCount:videos.filter(v=>v.unread).length,
  totalChannels:channels.length,loadedChannels:loaded,failedChannels:failed,pendingChannels,
  mutedChannelIds:state.mutedChannelIds,...(updatedAt?{updatedAt}:{}),errors,
  ...(lastBatch?{lastBatch}:{})};
}
async function refresh(groupId:string|null,force:boolean):Promise<SmartFeed>{
 const [catalog,caches,state]=await Promise.all([readCatalog(),getAllVideoCaches(),getSmartState()]);
 const channels=scopedChannels(catalog,groupId,new Set(state.mutedChannelIds));
 const byChannel=new Map(caches.map(x=>[x.channelId,x]));
 const eligible=chooseRefreshChannels(channels,byChannel,force);
 const candidates=eligible.slice(0,BATCH_LIMIT);
 const epoch=await readVideoCacheEpoch();
 // Coalesce the same channel across overlapping group and all-channel refreshes.
 // An epoch check in the IndexedDB write prevents stale fetches after restore.
 await Promise.all(candidates.map(channel=>globalFeedWork.run(epoch+":"+channel.id,async()=>{
  const cache=await loadChannelVideos(channel,byChannel.get(channel.id));
  await putVideoCache(cache,epoch);
 })));
 const result=await snapshot(groupId,{attempted:candidates.length,remaining:Math.max(0,eligible.length-candidates.length)});
 announceSmartChange();
 return result;
}
export async function smartAction(req:SmartVideoRequest):Promise<SmartVideoResponse>{
 try{
  switch(req.type){
   case "SMART_FEED_GET":return {ok:true,feed:await snapshot(req.groupId)};
   case "SMART_FEED_REFRESH":{
    const key=(req.groupId??"all")+":"+(req.force===true?"forced":"normal");
    if(!pending.has(key)){
     const job=refresh(req.groupId,req.force===true).finally(()=>{pending.delete(key);});
     pending.set(key,job);
    }
    return {ok:true,feed:await pending.get(key)!};
   }
   case "SMART_READ_SET":{
    if(!VIDEO_ID.test(req.videoId)||typeof req.read!=="boolean")throw new Error("Geçersiz okunma işlemi.");
    const changed=await setReadState([req.videoId],req.read);
    announceSmartChange();
    return {ok:true,changed};
   }
   case "SMART_READ_ALL":{
    const feed=await snapshot(req.groupId);
    const ids=feed.videos.filter(v=>v.unread).map(v=>v.id);
    const changed=await setReadState(ids,true);
    announceSmartChange();
    return {ok:true,changed};
   }
   case "SMART_MUTE_SET":{
    const catalog=await readCatalog();
    if(typeof req.channelId!=="string"||!catalog.channels.some(ch=>ch.id===req.channelId)||
       typeof req.muted!=="boolean")throw new Error("Bilinmeyen kanal.");
    await setMuteState(req.channelId,req.muted);
    announceSmartChange();
    return {ok:true,changed:1};
   }
  }
 }catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)};}
}
