import type {Catalog,Channel} from "./types";
import type {ChannelVideoCache,FeedSnapshot,VideoRequest,VideoResponse,VideoFeedItem} from "./video-types";
import {readCatalog} from "./db";
import {channelsInGroup} from "./groups";
import {getAllVideoCaches,getWatchedVideoIds,putVideoCache,setWatched} from "./video-db";
import {loadChannelVideos} from "./video-network";

const REFRESH_MS=30*60*1000;
const BATCH=50;
const VIDEO_ID=/^[A-Za-z0-9_-]{11}$/;
const feedRequests=new Map<string,Promise<FeedSnapshot>>();
function scope(c:Catalog,groupId:string|null):Channel[]{
 if(groupId!==null&&!c.groups.some(g=>g.id===groupId))throw new Error("Seçilen grup artık yok.");
 const allowed=groupId===null?null:channelsInGroup(c,groupId);
 return c.channels.filter(ch=>ch.subscribed&&(!allowed||allowed.has(ch.id)));
}
async function snapshot(groupId:string|null):Promise<FeedSnapshot>{
 const [catalog,caches,watchedIds]=await Promise.all([readCatalog(),getAllVideoCaches(),getWatchedVideoIds()]);
 const channels=scope(catalog,groupId),allowed=new Set(channels.map(c=>c.id)),watched=new Set(watchedIds);
 const videos=new Map<string,VideoFeedItem>();
 let loaded=0,failed=0,updatedAt="";
 const errors:string[]=[];
 for(const cache of caches){
  if(!allowed.has(cache.channelId))continue;
  if(cache.updatedAt&&cache.updatedAt>updatedAt)updatedAt=cache.updatedAt;
  if(cache.error){failed++;if(errors.length<6)errors.push(cache.error);}
  if(cache.videos.length||!cache.error)loaded++;
  for(const video of cache.videos){
   const previous=videos.get(video.id);
   if(!previous||video.kind!=="unknown"&&previous.kind==="unknown"){
    videos.set(video.id,{...video,watched:watched.has(video.id)});
   }
  }
 }
 return {videos:[...videos.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,2500),
  totalChannels:channels.length,loadedChannels:loaded,failedChannels:failed,
  ...(updatedAt?{updatedAt}:{}),errors};
}
async function refresh(groupId:string|null,force=false):Promise<FeedSnapshot>{
 const [catalog,caches]=await Promise.all([readCatalog(),getAllVideoCaches()]);
 const channels=scope(catalog,groupId);
 const records=new Map(caches.map(cache=>[cache.channelId,cache]));
 const stale=channels.filter(ch=>{
  const cache=records.get(ch.id);
  return force||!cache||Date.now()-Date.parse(cache.updatedAt)>REFRESH_MS;
 }).sort((a,b)=>{
  const older=records.get(a.id)?.updatedAt??"";
  const newer=records.get(b.id)?.updatedAt??"";
  return older.localeCompare(newer);
 }).slice(0,BATCH);
 let index=0;
 const workers=Array.from({length:Math.min(5,stale.length)},async()=>{
  while(index<stale.length){
   const channel=stale[index++]!;
   const fresh=await loadChannelVideos(channel,records.get(channel.id));
   await putVideoCache(fresh);
  }
 });
 await Promise.all(workers);
 return snapshot(groupId);
}
export async function videoAction(req:VideoRequest):Promise<VideoResponse>{
 try{
  switch(req.type){
   case "VIDEO_WATCHED_SET":{
    if(!VIDEO_ID.test(req.videoId)||typeof req.watched!=="boolean")throw new Error("Geçersiz video veya izleme durumu.");
    await setWatched(req.videoId,req.watched);
    return {ok:true,watched:req.watched};
   }
   case "VIDEO_GET":return {ok:true,feed:await snapshot(req.groupId)};
   case "VIDEO_REFRESH":{
    const key=req.groupId??"all";
    // Multiple dashboards requesting the same group share one pending fetch.
    if(!feedRequests.has(key)){
     const promise=refresh(req.groupId,req.force===true).finally(()=>{feedRequests.delete(key);});
     feedRequests.set(key,promise);
    }
    return {ok:true,feed:await feedRequests.get(key)!};
   }
  }
 }catch(e){return {ok:false,error:e instanceof Error?e.message:String(e)};}
}
