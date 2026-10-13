import {useCallback,useEffect,useState} from "react";
import type {VideoItem} from "./video-types";
import type {WatchRequest,WatchResponse,WatchState} from "./watch-types";
export async function watchRequest(req:WatchRequest):Promise<WatchState>{
 const result=await chrome.runtime.sendMessage(req) as WatchResponse;
 if(!result?.ok)throw new Error(result?.error??"İzleme kaydı başarısız.");
 return result.state;
}
export function useWatchState(){
 const [state,setState]=useState<WatchState>({queue:[],progress:[]});
 const [error,setError]=useState("");
 const [busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{
  try{setState(await watchRequest({type:"WATCH_GET"}));}catch(e){setError(String(e));}
 },[]);
 useEffect(()=>{
  let active=true;
  void watchRequest({type:"WATCH_GET"}).then(x=>{if(active)setState(x);}).catch(e=>{if(active)setError(String(e));});
  const handler=(message:unknown)=>{
   if(message&&typeof message==="object"&&"type" in message&&message.type==="WATCH_UPDATED")
    void watchRequest({type:"WATCH_GET"}).then(x=>{if(active)setState(x);}).catch(()=>undefined);
   return false;
  };
  chrome.runtime.onMessage.addListener(handler);
  const focus=()=>{void watchRequest({type:"WATCH_GET"}).then(x=>{if(active)setState(x);}).catch(()=>undefined);};
  window.addEventListener("focus",focus);
  return ()=>{active=false;chrome.runtime.onMessage.removeListener(handler);window.removeEventListener("focus",focus);};
 },[]);
 const action=useCallback(async(req:WatchRequest)=>{
  setBusy(true);setError("");
  try{setState(await watchRequest(req));}
  catch(e){setError(e instanceof Error?e.message:String(e));}
  finally{setBusy(false);}
 },[]);
 const add=useCallback((video:VideoItem)=>action({type:"WATCH_QUEUE_ADD",video}),[action]);
 const remove=useCallback((videoId:string)=>action({type:"WATCH_QUEUE_REMOVE",videoId}),[action]);
 const move=useCallback((videoId:string,toIndex:number)=>action({type:"WATCH_QUEUE_MOVE",videoId,toIndex}),[action]);
 return {state,busy,error,refresh,action,add,remove,move};
}
