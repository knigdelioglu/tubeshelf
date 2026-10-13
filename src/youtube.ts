import type {ChannelInput} from "./types";
const ENDPOINT="https://www.googleapis.com/youtube/v3/subscriptions";
interface YoutubeItem {snippet?:{title?:string;resourceId?:{channelId?:string};thumbnails?:{default?:{url?:string}}}}
interface YoutubePage {items?:YoutubeItem[];nextPageToken?:string;error?:{message?:string}}
export async function fetchSubscriptions(interactive:boolean):Promise<ChannelInput[]>{
 const manifest=chrome.runtime.getManifest();
 if(!manifest.oauth2?.client_id)throw new Error("Google OAuth ayarlanmamış. CSV içe aktarma kullanın veya README içindeki OAuth kurulumunu tamamlayın.");
 const token=await chrome.identity.getAuthToken({interactive});
 if(!token?.token)throw new Error("Google oturumundan erişim anahtarı alınamadı.");
 const collected:ChannelInput[]=[];
 let pageToken:string|undefined;
 const visited=new Set<string>();
 do{
  const url=new URL(ENDPOINT);
  url.searchParams.set("part","snippet");
  url.searchParams.set("mine","true");
  url.searchParams.set("maxResults","50");
  if(pageToken){
   if(visited.has(pageToken))throw new Error("YouTube API yinelenen sayfa belirteci gönderdi; eşitleme iptal edildi.");
   visited.add(pageToken);url.searchParams.set("pageToken",pageToken);
  }
  const response=await fetch(url.toString(),{headers:{Authorization:"Bearer "+token.token}});
  if(response.status===401){await chrome.identity.removeCachedAuthToken({token:token.token});throw new Error("Google yetkilendirmesi sona erdi. Yeniden deneyin.");}
  if(!response.ok)throw new Error("YouTube API yanıtı: HTTP "+response.status);
  const body=await response.json() as YoutubePage;
  if(!Array.isArray(body.items))throw new Error("YouTube API beklenmeyen veri döndürdü; eşitleme iptal edildi.");
  for(const item of body.items){
   const id=item.snippet?.resourceId?.channelId,title=item.snippet?.title;
   if(id&&title)collected.push({id,title,thumbnailUrl:item.snippet?.thumbnails?.default?.url});
  }
  if(body.nextPageToken!==undefined&&typeof body.nextPageToken!=="string")throw new Error("YouTube API sayfa belirteci geçersiz.");
  pageToken=body.nextPageToken;
  if(collected.length>25000)throw new Error("Abonelik sınırı aşıldı.");
 }while(pageToken);
 if(!collected.length)throw new Error("Hesapta okunabilir abonelik bulunamadı. Mevcut veriler değiştirilmedi.");
 return collected;
}
