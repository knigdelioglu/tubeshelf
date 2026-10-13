import type {Channel} from "./types";
import type {ChannelVideoCache,VideoItem,VideoKind} from "./video-types";
import {parseAtom,feedUrl,standardFeedUrl,findCanonicalChannelId,mergeFeedKinds} from "./video-rss";
import {CHANNEL_ID} from "./channel-ref";

const TIMEOUT=8500;
const MAX_RESPONSE_BYTES=2*1024*1024;
/** Read response bodies with a strict size cap, including for chunked responses. */
export async function boundedText(response:Response,limit=MAX_RESPONSE_BYTES):Promise<string>{
 const length=response.headers.get("content-length");
 if(length&&Number(length)>limit)throw new Error("YouTube yanıtı boyut sınırını aşıyor.");
 if(!response.body){
  const text=await response.text();
  if(new TextEncoder().encode(text).byteLength>limit)throw new Error("YouTube yanıtı boyut sınırını aşıyor.");
  return text;
 }
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let bytes=0,text="";
 try{
  while(true){
   const item=await reader.read();
   if(item.done)break;
   bytes+=item.value.byteLength;
   if(bytes>limit)throw new Error("YouTube yanıtı boyut sınırını aşıyor.");
   text+=decoder.decode(item.value,{stream:true});
  }
  return text+decoder.decode();
 }finally{
  reader.releaseLock();
  if(bytes>limit)void response.body.cancel().catch(()=>undefined);
 }
}
async function loadText(url:string):Promise<string> {
 const response=await fetch(url,{credentials:"omit",signal:AbortSignal.timeout(TIMEOUT)});
 if(!response.ok)throw new Error("YouTube yayın HTTP "+response.status);
 return boundedText(response);
}
async function canonicalId(channel:Channel,previous?:ChannelVideoCache):Promise<string> {
 if(CHANNEL_ID.test(channel.id))return channel.id;
 if(previous?.canonicalId&&CHANNEL_ID.test(previous.canonicalId))return previous.canonicalId;
 if(!channel.id.startsWith("handle:"))throw new Error("Bu kanalın RSS kimliği yok.");
 const name=channel.id.slice(7);
 const html=await loadText("https://www.youtube.com/@"+encodeURIComponent(name));
 const canonical=findCanonicalChannelId(html);
 if(!canonical)throw new Error(channel.title+": YouTube kanal kimliği çözümlenemedi.");
 return canonical;
}
async function category(id:string,title:string,ref:string,kind:Exclude<VideoKind,"unknown">):Promise<VideoItem[]> {
 const xml=await loadText(feedUrl(id,kind));
 return parseAtom(xml,ref,title,kind);
}
export async function loadChannelVideos(channel:Channel,previous?:ChannelVideoCache):Promise<ChannelVideoCache> {
 const fetchedAt=new Date().toISOString();
 try {
  const id=await canonicalId(channel,previous);
  const kinds=["video","short","live"] as const;
  const all=await Promise.allSettled(kinds.map(kind=>category(id,channel.title,channel.id,kind)));
  const parts:VideoItem[][]=[];
  const missing:string[]=[];
  for(let i=0;i<all.length;i++){
   const result=all[i]!;
   if(result.status==="fulfilled")parts.push(result.value);
   else missing.push(kinds[i]!);
  }
  // An unavailable undocumented category feed cannot be interpreted as an empty category.
  if(missing.length||parts.every(part=>part.length===0)) {
   try{
    const general=parseAtom(await loadText(standardFeedUrl(id)),channel.id,channel.title,"unknown");
    parts.push(general);
   }catch(err){
    if(!parts.length)throw err;
   }
  }
  if(!parts.length)throw new Error("YouTube kanala ait yayın döndürmedi.");
  const videos=mergeFeedKinds(parts).slice(0,75);
  return {channelId:channel.id,canonicalId:id,updatedAt:fetchedAt,attemptedAt:fetchedAt,consecutiveFailures:0,videos,
   ...(missing.length?{error:"Bazı video türleri doğrulanamadı: "+missing.join(", ")}:{})};
 }catch(e){
  if(previous?.videos.length){
   return {...previous,attemptedAt:fetchedAt,consecutiveFailures:(previous.consecutiveFailures??0)+1,error:e instanceof Error?e.message:String(e)};
  }
  return {channelId:channel.id,updatedAt:"",attemptedAt:fetchedAt,consecutiveFailures:(previous?.consecutiveFailures??0)+1,videos:[],error:e instanceof Error?e.message:String(e)};
 }
}
