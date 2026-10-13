import {useCallback,useEffect,useState} from "react";
import type {FeedSnapshot,VideoRequest,VideoResponse} from "./video-types";

async function request(req:VideoRequest):Promise<VideoResponse>{
 const result=await chrome.runtime.sendMessage(req) as VideoResponse;
 if(!result?.ok)throw new Error(result?.error??"Video işlemi başarısız oldu.");
 return result;
}
export function useVideoFeed(groupId:string|null,revision:number){
 const [feed,setFeed]=useState<FeedSnapshot|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const get=useCallback(async()=> {
  const result=await request({type:"VIDEO_GET",groupId});
  if(result.ok&&"feed" in result)return result.feed;
  throw new Error("Video listesi alınamadı.");
 },[groupId]);
 const refresh=useCallback(async()=>{
  setBusy(true);setError("");
  try{
   const result=await request({type:"VIDEO_REFRESH",groupId});
   if(result.ok&&"feed" in result)setFeed(result.feed);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 },[groupId]);
 useEffect(()=>{
  let active=true;
  setFeed(null);setError("");
  void get().then(next=>{if(active)setFeed(next);}).catch(e=>{if(active)setError(String(e));});
  // A cached group does not cause extra network activity during the next 30 minutes.
  void request({type:"VIDEO_REFRESH",groupId}).then(result=>{
   if(active&&result.ok&&"feed" in result)setFeed(result.feed);
  }).catch(e=>{if(active)setError(e instanceof Error?e.message:String(e));});
  function focused(){
   void get().then(result=>{if(active)setFeed(result);}).catch(()=>undefined);
  }
  window.addEventListener("focus",focused);
  return()=>{active=false;window.removeEventListener("focus",focused);};
 },[get,groupId,revision]);
 async function markWatched(videoId:string,watched:boolean){
  setFeed(current=>current?{...current,videos:current.videos.map(v=>v.id===videoId?{...v,watched}:v)}:current);
  try{await request({type:"VIDEO_WATCHED_SET",videoId,watched});}
  catch(e){setError(e instanceof Error?e.message:String(e));setFeed(await get());}
 }
 return {feed,busy,error,refresh,markWatched};
}
