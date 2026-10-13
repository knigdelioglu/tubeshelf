import type {VideoItem,VideoKind} from "./video-types";
const VID=/^[a-zA-Z0-9_-]{11}$/;
const UC=/^UC[a-zA-Z0-9_-]{22}$/;
export function entityDecode(s:string):string {
 const entities:Record<string,string>={amp:"&",lt:"<",gt:">",quot:'"',apos:"'",nbsp:" "};
 return s.replace(/&(#(?:x[0-9a-fA-F]+|[0-9]+)|[a-zA-Z]+);/g,(whole,key:string)=>{
  if(key[0]!=="#")return entities[key]??whole;
  const num=key[1]?.toLowerCase()==="x"?parseInt(key.slice(2),16):parseInt(key.slice(1),10);
  return Number.isInteger(num)&&num>0&&num<=0x10ffff&&!(num>=0xd800&&num<=0xdfff)?String.fromCodePoint(num):whole;
 });
}
function tag(xml:string,name:string):string|undefined {
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
 const match=xml.match(new RegExp("<"+escaped+"(?:\\s[^>]*)?>([\\s\\S]*?)<\\/"+escaped+">","i"));
 const value=match?.[1]?.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/,"$1");
 return value===undefined?undefined:entityDecode(value).trim();
}
export function feedUrl(id:string,kind:Exclude<VideoKind,"unknown">):string {
 if(!UC.test(id))throw new Error("Geçersiz YouTube kanal kimliği.");
 const key=kind==="video"?"UULF":kind==="short"?"UUSH":"UULV";
 return "https://www.youtube.com/feeds/videos.xml?playlist_id="+key+id.slice(2);
}
export function standardFeedUrl(id:string):string {
 if(!UC.test(id))throw new Error("Geçersiz YouTube kanal kimliği.");
 return "https://www.youtube.com/feeds/videos.xml?channel_id="+id;
}
export function parseAtom(xml:string,channelId:string,channelTitle:string,kind:VideoKind):VideoItem[] {
 if(!/<(?:[A-Za-z]+:)?feed(?:\s|>)/i.test(xml))throw new Error("YouTube geçerli bir yayın döndürmedi.");
 const result:VideoItem[]=[];
 const re=/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi;
 for(const match of xml.matchAll(re)){
  const body=match[1]??"";
  const id=tag(body,"yt:videoId")??"";
  const title=tag(body,"title")??"";
  const date=tag(body,"published")??"";
  if(!VID.test(id)||!title||!Number.isFinite(Date.parse(date)))continue;
  result.push({
   id,title: title.slice(0,400),channelId,channelTitle,
   publishedAt:new Date(date).toISOString(),kind,
   thumbnail:"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg",
   url:kind==="short"?"https://www.youtube.com/shorts/"+id:"https://www.youtube.com/watch?v="+id
  });
 }
 return result;
}
export function mergeFeedKinds(parts:VideoItem[][]):VideoItem[] {
 const priority:Record<VideoKind,number>={unknown:0,video:1,short:2,live:3};
 const byId=new Map<string,VideoItem>();
 for(const part of parts)for(const item of part){
  const prior=byId.get(item.id);
  if(!prior||priority[item.kind]>priority[prior.kind])byId.set(item.id,item);
 }
 return [...byId.values()].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
}
export function findCanonicalChannelId(html:string):string|null{
 // Handle pages advertise the canonical channel through the public RSS link.
 const matches=html.match(/(?:channel_id=|\\u0026channel_id=)(UC[A-Za-z0-9_-]{22})/);
 return matches?.[1]??html.match(/"externalId"\s*:\s*"(UC[A-Za-z0-9_-]{22})"/)?.[1]??null;
}
