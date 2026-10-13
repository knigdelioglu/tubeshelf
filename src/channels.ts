import type {Catalog,ChannelInput,Membership} from "./types";
import {changed,now} from "./groups";
import {isChannelRef} from "./channel-ref";
export function importChannels(c:Catalog,inputs:ChannelInput[],fullSync=false):Catalog {
 if(inputs.length>25000)throw new Error("Çok fazla kanal aktarıldı.");
 const map=new Map(c.channels.map(ch=>[ch.id,{...ch,subscribed:fullSync?false:ch.subscribed}]));
 const seen=new Set<string>();
 for(const input of inputs){
  if(!isChannelRef(input.id)||!input.title.trim()||input.title.length>300||seen.has(input.id))continue;
  seen.add(input.id);
  const old=map.get(input.id);
  map.set(input.id,{...old,id:input.id,title:input.title.trim(),subscribed:true,
   thumbnailUrl:input.thumbnailUrl?.startsWith("https://")?input.thumbnailUrl:old?.thumbnailUrl,lastSeenAt:now()});
 }
 if(!seen.size)throw new Error("Geçerli kanal bulunamadı.");
 if(map.size>25000)throw new Error("Kanal sınırı aşıldı.");
 return changed(c,{channels:[...map.values()],...(fullSync?{lastSyncedAt:now()}:{})});
}
export function setMembership(c:Catalog,groupId:string,channelIds:string[],enabled:boolean):Catalog {
 if(!c.groups.some(g=>g.id===groupId))throw new Error("Grup bulunamadı.");
 const known=new Set(c.channels.map(ch=>ch.id));
 const ids=new Set(channelIds);
 if(ids.size>25000||[...ids].some(id=>!known.has(id)))throw new Error("Geçersiz kanal seçimi.");
 const key=(m:Membership)=>m.groupId+":"+m.channelId;
 const map=new Map(c.memberships.map(m=>[key(m),m]));
 for(const channelId of ids){const m={groupId,channelId};if(enabled)map.set(key(m),m);else map.delete(key(m));}
 return changed(c,{memberships:[...map.values()]});
}
