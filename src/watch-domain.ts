import type {VideoItem} from "./video-types";
import type {QueuedVideo,PlaybackProgress} from "./watch-types";
const ID=/^[A-Za-z0-9_-]{11}$/;
export function videoIsValid(input:unknown):input is VideoItem{
 if(!input||typeof input!=="object")return false;
 const v=input as Partial<VideoItem>;
 return typeof v.id==="string"&&ID.test(v.id)&&typeof v.channelId==="string"&&v.channelId.length<=100&&
  typeof v.channelTitle==="string"&&v.channelTitle.length<=300&&typeof v.title==="string"&&v.title.trim().length>0&&v.title.length<=400&&
  typeof v.publishedAt==="string"&&Number.isFinite(Date.parse(v.publishedAt))&&
  ["video","short","live","unknown"].includes(v.kind??"")&&
  typeof v.url==="string"&&/^https:\/\/www\.youtube\.com\/(watch\?v=|shorts\/)/.test(v.url)&&
  typeof v.thumbnail==="string"&&/^https:\/\/i\.ytimg\.com\//.test(v.thumbnail);
}
export function addToQueue(queue:QueuedVideo[],video:VideoItem,time=new Date().toISOString()):QueuedVideo[]{
 if(!videoIsValid(video))throw new Error("Kuyruğa eklenecek video geçersiz.");
 if(queue.some(v=>v.id===video.id))return queue;
 if(queue.length>=300)throw new Error("Kuyruk en fazla 300 video tutabilir.");
 return [...queue,{...video,addedAt:time}];
}
export function moveInQueue(queue:QueuedVideo[],videoId:string,toIndex:number):QueuedVideo[]{
 const index=queue.findIndex(v=>v.id===videoId);
 if(index<0)throw new Error("Video kuyrukta bulunamadı.");
 if(!Number.isInteger(toIndex)||toIndex<0||toIndex>=queue.length)throw new Error("Kuyruk hedefi geçersiz.");
 if(index===toIndex)return queue;
 const next=[...queue],item=next.splice(index,1)[0]!;
 next.splice(toIndex,0,item);
 return next;
}
export function progressFor(videoId:string,position:number,duration:number,at=new Date().toISOString()):PlaybackProgress{
 if(!ID.test(videoId)||!Number.isFinite(position)||!Number.isFinite(duration)||duration<=0||duration>24*3600||position<0||position>duration+2)
  throw new Error("İzleme ilerlemesi geçersiz.");
 const clamped=Math.min(position,duration);
 const completed=clamped>=duration*0.9||duration-clamped<=10&&clamped>=15;
 return {videoId,position:completed?duration:Math.round(clamped),duration:Math.round(duration),updatedAt:at,completed};
}
export function resumeUrl(video:VideoItem,progress?:PlaybackProgress):string{
 // Never interpolate remote URLs; synthesize from validated ID.
 if(!/^[A-Za-z0-9_-]{11}$/.test(video.id))throw new Error("Geçersiz video.");
 const seconds=progress&&!progress.completed?Math.max(0,Math.floor(progress.position)-3):0;
 const target="https://www.youtube.com/watch?v="+video.id;
 return seconds>=5?target+"&t="+seconds+"s":target;
}
