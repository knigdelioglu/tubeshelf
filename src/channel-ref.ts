/** Identifiers visible in YouTube's UI; canonical UC IDs are preferred. */
export const CHANNEL_ID=/^UC[A-Za-z0-9_-]{22}$/;
const HANDLE=/^[\p{L}\p{N}._-]{3,80}$/u;

export function isChannelRef(id:string):boolean {
 return CHANNEL_ID.test(id)||(id.startsWith("handle:")&&HANDLE.test(id.slice(7)));
}
export function channelUrl(id:string):string {
 if(CHANNEL_ID.test(id))return "https://www.youtube.com/channel/"+id;
 if(isChannelRef(id))return "https://www.youtube.com/@" + encodeURIComponent(id.slice(7));
 throw new Error("Geçersiz YouTube kanal kimliği.");
}
export function channelRefFromUrl(raw:string):string|null {
 try {
  const url=new URL(raw,"https://www.youtube.com");
  if(url.protocol!=="https:"||url.hostname!=="www.youtube.com")return null;
  const byId=url.pathname.match(/^\/channel\/(UC[A-Za-z0-9_-]{22})(?:\/|$)/);
  if(byId)return byId[1]!;
  const byHandle=url.pathname.match(/^\/@([^/]+)(?:\/|$)/);
  if(byHandle) {
   const id="handle:"+decodeURIComponent(byHandle[1]!);
   return isChannelRef(id)?id:null;
  }
 }catch {return null;}
 return null;
}
