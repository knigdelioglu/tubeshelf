import {useCallback,useEffect,useState} from "react";
import type {SmartFeed,SmartVideoRequest,SmartVideoResponse} from "./smart-types";
import type {VideoResponse} from "./video-types";

async function smart(req:SmartVideoRequest):Promise<SmartVideoResponse>{
 const response=await chrome.runtime.sendMessage(req) as SmartVideoResponse;
 if(!response?.ok)throw new Error(response?.error??"Akıllı Akış isteği başarısız.");
 return response;
}
export function useSmartFeed(groupId:string|null,revision:number){
 const [feed,setFeed]=useState<SmartFeed|null>(null);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const reload=useCallback(async()=>{
  const result=await smart({type:"SMART_FEED_GET",groupId});
  if(result.ok&&"feed" in result)setFeed(result.feed);
 },[groupId]);
 const refresh=useCallback(async(force=true)=>{
  setBusy(true);setError("");
  try{
   const result=await smart({type:"SMART_FEED_REFRESH",groupId,force});
   if(result.ok&&"feed" in result)setFeed(result.feed);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 },[groupId]);
 useEffect(()=>{
  let active=true;setFeed(null);setError("");setBusy(true);
  void (async()=>{
   try{
    const cached=await smart({type:"SMART_FEED_GET",groupId});
    if(active&&cached.ok&&"feed" in cached)setFeed(cached.feed);
    const result=await smart({type:"SMART_FEED_REFRESH",groupId,force:false});
    if(active&&result.ok&&"feed" in result)setFeed(result.feed);
   }catch(e){if(active)setError(e instanceof Error?e.message:String(e));}
   finally{if(active)setBusy(false);}
  })();
  const notify=(raw:unknown)=>{
   if(raw&&typeof raw==="object"&&"type" in raw&&raw.type==="SMART_UPDATED"){
    void smart({type:"SMART_FEED_GET",groupId}).then(result=>{
     if(active&&result.ok&&"feed" in result)setFeed(result.feed);
    }).catch(()=>undefined);
   }
   return false;
  };
  chrome.runtime.onMessage.addListener(notify);
  const focus=()=>{void smart({type:"SMART_FEED_GET",groupId}).then(result=>{
   if(active&&result.ok&&"feed" in result)setFeed(result.feed);
  }).catch(()=>undefined);};
  window.addEventListener("focus",focus);
  return ()=>{active=false;chrome.runtime.onMessage.removeListener(notify);window.removeEventListener("focus",focus);};
 },[groupId,revision]);
 const action=useCallback(async(req:SmartVideoRequest)=>{
  setError("");
  try{
   await smart(req);
   await reload();
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 },[reload]);
 const markWatched=useCallback(async(videoId:string,watched:boolean)=>{
  setError("");
  try{
   const result=await chrome.runtime.sendMessage({type:"VIDEO_WATCHED_SET",videoId,watched}) as VideoResponse;
   if(!result.ok)throw new Error(result.error);
   await reload();
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 },[reload]);
 return {feed,busy,error,refresh,action,markWatched};
}
