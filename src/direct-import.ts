import type {ChannelInput,DirectImportStatus} from "./types";
import {CHANNEL_ID,channelRefFromUrl,isChannelRef} from "./channel-ref";

type ChannelElement=Element&{data?:unknown};
const SELECTORS="ytd-channel-renderer,ytd-grid-channel-renderer";
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

function stringProp(data:unknown,key:string):string|undefined {
 if(!data||typeof data!=="object")return undefined;
 const value=(data as Record<string,unknown>)[key];
 return typeof value==="string"?value:undefined;
}
export function extractChannel(el:Element):ChannelInput|null {
 const node=el as ChannelElement;
 const data=node.data;
 const nested=(data&&typeof data==="object"&&"channelRenderer" in data)?
  (data as {channelRenderer?:unknown}).channelRenderer:data;
 const id=stringProp(nested,"channelId")||stringProp(data,"channelId");
 const links=el.querySelectorAll<HTMLAnchorElement>("a[href]");
 const main=el.querySelector<HTMLAnchorElement>("a#main-link,a#channel-title,a[href*='/channel/'],a[href^='/@']");
 const title=(
  main?.querySelector("#text,yt-formatted-string")?.textContent||
  el.querySelector("#channel-title,#main-link #text,#text.ytd-channel-renderer")?.textContent||
  main?.textContent||""
 ).replace(/\s+/g," ").trim();
 let channelRef=id&&CHANNEL_ID.test(id)?id:null;
 if(!channelRef){
  for(const link of links){
   channelRef=channelRefFromUrl(link.href);
   if(channelRef)break;
  }
 }
 if(!channelRef||!isChannelRef(channelRef)||!title||title.length>300)return null;
 const src=el.querySelector<HTMLImageElement>("img[src]")?.src;
 return {id:channelRef,title,...(src?.startsWith("https://")?{thumbnailUrl:src}:{})};
}
async function updateProgress(status:DirectImportStatus):Promise<void>{
 await chrome.storage.local.set({directImportStatus:status});
}
export async function scanSubscriptions(
 session:{token:string;tabId:number;startedAt:number}
):Promise<void>{
 const discovered=new Map<string,ChannelInput>();
 const begin=Date.now();
 let stable=0,lastHeight=-1,lastCount=-1,complete=false;
 try{
  // Only read channel cards displayed by YouTube. Never call private endpoints.
  for(let round=0;round<180;round++){
   if(location.pathname!=="/feed/channels")throw new Error("YouTube abonelikler sayfasından ayrıldınız.");
   const cards=document.querySelectorAll(SELECTORS);
   for(const card of cards){
    const channel=extractChannel(card);
    if(channel)discovered.set(channel.id,channel);
   }
   if(round%3===0){
    await updateProgress({state:"scanning",count:discovered.size,startedAt:session.startedAt,tabId:session.tabId,token:session.token});
   }
   const scroller=document.scrollingElement??document.documentElement;
   const height=Math.max(scroller.scrollHeight,document.body.scrollHeight);
   const bottom=scroller.scrollTop+window.innerHeight>=height-100;
   if(discovered.size>0&&bottom&&height===lastHeight&&lastCount===discovered.size)stable++;
   else stable=0;
   if(stable>=6){complete=true;break;}
   lastHeight=height;lastCount=discovered.size;
   if(Date.now()-begin>150000)break;
   window.scrollTo(0,height);
   await sleep(round<12?650:450);
  }
  if(!complete)throw new Error(discovered.size===0
   ?"Abonelik kanalları okunamadı. YouTube hesabınızda oturum açtığınızdan ve Abonelikler sayfasının yüklendiğinden emin olun."
   :"YouTube listesi sonuna güvenle ulaşılamadı. Kısmi veri kaydetmedim. Sayfayı kontrol edip tekrar deneyin.");
  const channels=[...discovered.values()];
  if(!channels.length)throw new Error("İçe aktarılabilecek kanal bulunamadı.");
  const response=await chrome.runtime.sendMessage({type:"DIRECT_IMPORT_COMMIT",token:session.token,channels}) as {ok:boolean;error?:string};
  if(!response?.ok)throw new Error(response?.error??"Abonelikler kaydedilemedi.");
 }catch(err){
  const {directImportStatus}=await chrome.storage.local.get("directImportStatus");
  if(directImportStatus?.token===session.token){
   await updateProgress({state:"error",count:discovered.size,startedAt:session.startedAt,tabId:session.tabId,token:session.token,
    error:err instanceof Error?err.message:String(err)});
  }
 }
}
