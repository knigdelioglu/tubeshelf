import type {WatchRequest,WatchResponse,WatchState} from "./watch-types";
import {getWatchState,writeQueue,writeProgress} from "./watch-db";
import {addToQueue,moveInQueue,progressFor} from "./watch-domain";
import {setWatched} from "./video-db";

const ID=/^[A-Za-z0-9_-]{11}$/;
let serial:Promise<unknown>=Promise.resolve();
function exclusive<T>(job:()=>Promise<T>):Promise<T>{
 const next=serial.then(job);
 serial=next.then(()=>undefined,()=>undefined);
 return next;
}
function changed():void{
 void chrome.runtime.sendMessage({type:"WATCH_UPDATED"}).catch(()=>undefined);
}
export async function watchAction(req:WatchRequest):Promise<WatchResponse>{
 try{
  const state=await exclusive(async():Promise<WatchState>=>{
   if(req.type==="WATCH_GET")return getWatchState();
   if(req.type==="WATCH_QUEUE_ADD"){
    const current=await getWatchState();
    const queue=addToQueue(current.queue,req.video);
    if(queue!==current.queue)await writeQueue(queue);
   }else if(req.type==="WATCH_QUEUE_REMOVE"){
    if(!ID.test(req.videoId))throw new Error("Geçersiz video kimliği.");
    const current=await getWatchState();
    await writeQueue(current.queue.filter(x=>x.id!==req.videoId));
   }else if(req.type==="WATCH_QUEUE_MOVE"){
    const current=await getWatchState();
    const queue=moveInQueue(current.queue,req.videoId,req.toIndex);
    if(queue!==current.queue)await writeQueue(queue);
   }else if(req.type==="WATCH_QUEUE_CLEAR"){
    await writeQueue([]);
   }else if(req.type==="WATCH_PROGRESS_SET"){
    const current=progressFor(req.videoId,req.position,req.duration);
    const last=(await getWatchState()).progress.find(x=>x.videoId===req.videoId);
    // Do not regress progress from older tabs or out-of-order async messages.
    if(!last||!last.completed&&(current.position>last.position||current.completed)){
     await writeProgress(current,req.videoId);
     if(current.completed)await setWatched(req.videoId,true);
    }
   }else if(req.type==="WATCH_COMPLETE"){
    if(!ID.test(req.videoId))throw new Error("Geçersiz video kimliği.");
    const last=(await getWatchState()).progress.find(x=>x.videoId===req.videoId);
    await writeProgress({videoId:req.videoId,position:last?.duration??0,duration:last?.duration??0,
     completed:true,updatedAt:new Date().toISOString()},req.videoId);
    await setWatched(req.videoId,true);
   }else if(req.type==="WATCH_PROGRESS_RESET"){
    if(!ID.test(req.videoId))throw new Error("Geçersiz video kimliği.");
    await writeProgress(null,req.videoId);
   }
   return getWatchState();
  });
  if(req.type!=="WATCH_GET")changed();
  return {ok:true,state};
 }catch(e){
  return {ok:false,error:e instanceof Error?e.message:String(e)};
 }
}
