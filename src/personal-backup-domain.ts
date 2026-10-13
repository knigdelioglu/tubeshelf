import type {Catalog} from "./types";
import type {QueuedVideo,PlaybackProgress} from "./watch-types";
import type {SmartFilter} from "./smart-types";
import type {CenterPreferences,GroupNotificationConfig} from "./center-types";
import {validateBackup} from "./backup";
import {videoIsValid} from "./watch-domain";
import {normalizeCenterPrefs,normalizeNotifications} from "./center-domain";
import {validateFilter} from "./smart-domain";
import {isChannelRef} from "./channel-ref";

export const BACKUP_KIND="tubeshelf-personal-backup" as const;
export const BACKUP_VERSION=2 as const;
const VIDEO=/^[A-Za-z0-9_-]{11}$/;
const DATE=(v:unknown)=>typeof v==="string"&&Number.isFinite(Date.parse(v));
export interface PersonalBackup {
 kind:typeof BACKUP_KIND;version:typeof BACKUP_VERSION;exportedAt:string;
 catalog:Catalog;
 watchedVideoIds:string[];readVideoIds:string[];mutedChannelIds:string[];
 inboxBaseline:string;
 queue:QueuedVideo[];progress:PlaybackProgress[];
 preferences:{center:CenterPreferences;filters:Record<string,SmartFilter>;
  notificationGroups:GroupNotificationConfig};
}
export type RestorePreview={format:"full"|"legacy";channels:number;groups:number;queue:number;
 watched:number;read:number;muted:number;progress:number;filters:number;
 notice:string};
export type ParsedBackup={data:PersonalBackup;preview:RestorePreview};

function ids(value:unknown,max:number,what:string,check:(id:string)=>boolean):string[]{
 if(!Array.isArray(value)||value.length>max)throw new Error(what+" listesi geçersiz veya fazla büyük.");
 const result=new Set<string>();
 for(const id of value){
  if(typeof id!=="string"||!check(id))throw new Error(what+" kimliği geçersiz.");
  result.add(id);
 }
 return [...result];
}
function queue(raw:unknown):QueuedVideo[]{
 if(!Array.isArray(raw)||raw.length>300)throw new Error("Kuyruk geçersiz veya 300 video sınırı aşıldı.");
 const found=new Set<string>();
 return raw.map(v=>{
  if(!videoIsValid(v)||!v||typeof v!=="object"||!DATE((v as QueuedVideo).addedAt))
   throw new Error("Kuyrukta geçersiz video var.");
  const item=v as QueuedVideo;
  if(found.has(item.id))throw new Error("Kuyrukta yinelenen video var.");
  found.add(item.id);
  return {...item};
 });
}
function progress(raw:unknown):PlaybackProgress[]{
 if(!Array.isArray(raw)||raw.length>50000)throw new Error("İlerleme kayıtları çok büyük veya bozuk.");
 const found=new Set<string>();
 return raw.map(item=>{
  if(!item||typeof item!=="object")throw new Error("Bozuk oynatma kaydı.");
  const p=item as PlaybackProgress;
  if(!VIDEO.test(p.videoId)||!DATE(p.updatedAt)||typeof p.completed!=="boolean"||
   !Number.isFinite(p.position)||!Number.isFinite(p.duration)||
   p.duration<0||p.duration>86400||p.position<0||p.position>p.duration+2||
   (!p.completed&&p.duration===0)||(!p.completed&&p.position>=p.duration+0.01))
    throw new Error("Oynatma ilerlemesi geçersiz.");
  if(found.has(p.videoId))throw new Error("Tekrarlı oynatma ilerlemesi.");
  found.add(p.videoId);
  return {...p};
 });
}
function filters(raw:unknown,catalog:Catalog):Record<string,SmartFilter>{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Filtre ayarları geçersiz.");
 const entries=Object.entries(raw);
 if(entries.length>500)throw new Error("Çok fazla filtre ayarı var.");
 const validGroups=new Set(catalog.groups.map(g=>g.id));
 const result:Record<string,SmartFilter>={};
 for(const [key,value] of entries){
  if(key.length>180||!/^smartFilter:v1:(inbox|feed|board):(all|[\w-]{1,100})$/.test(key))
    throw new Error("Geçersiz filtre anahtarı.");
  const group=key.split(":")[3]!;
  if(group!=="all"&&!validGroups.has(group))continue;
  result[key]=validateFilter(value);
 }
 return result;
}
export function parsePersonalBackup(raw:unknown):ParsedBackup{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw new Error("Yedek dosyası geçersiz.");
 const record=raw as Record<string,unknown>;
 if(record.kind!==BACKUP_KIND){
  // Older, group-only JSON files remain importable.
  const catalog=validateBackup(raw);
  const data:PersonalBackup={kind:BACKUP_KIND,version:BACKUP_VERSION,exportedAt:new Date().toISOString(),
   catalog,watchedVideoIds:[],readVideoIds:[],mutedChannelIds:[],inboxBaseline:new Date().toISOString(),
   queue:[],progress:[],preferences:{
    center:normalizeCenterPrefs(null,catalog),filters:{},
    notificationGroups:normalizeNotifications(null,new Set(catalog.groups.map(g=>g.id)))
   }};
  return {data,preview:{format:"legacy",channels:catalog.channels.length,groups:catalog.groups.length,
   queue:0,watched:0,read:0,muted:0,progress:0,filters:0,
   notice:"Eski grup yedeği: yalnızca kanal ve grup düzeni geri yüklenecek. Diğer kişisel veriler korunacak."}};
 }
 if(record.version!==BACKUP_VERSION)throw new Error("Bu yedek sürümü desteklenmiyor.");
 if(!DATE(record.exportedAt))throw new Error("Yedek oluşturma tarihi geçersiz.");
 const catalog=validateBackup(record.catalog);
 const q=queue(record.queue),p=progress(record.progress);
 const watched=ids(record.watchedVideoIds,100000,"İzlenmiş video",x=>VIDEO.test(x));
 const read=ids(record.readVideoIds,100000,"Okunmuş video",x=>VIDEO.test(x));
 const muted=ids(record.mutedChannelIds,25000,"Sessiz kanal",isChannelRef);
 if(!DATE(record.inboxBaseline))throw new Error("Gelen kutusu başlangıcı geçersiz.");
 const pref=record.preferences;
 if(!pref||typeof pref!=="object"||Array.isArray(pref))throw new Error("Ayarlar geçersiz.");
 const settings=pref as Record<string,unknown>;
 const center=normalizeCenterPrefs(settings.center,catalog);
 const filterSettings=filters(settings.filters,catalog);
 const notificationGroups=normalizeNotifications(settings.notificationGroups,
  new Set(catalog.groups.map(g=>g.id)));
 notificationGroups.enabled=false; // Never transfer notification permission or enabled state.
 const data:PersonalBackup={
  kind:BACKUP_KIND,version:BACKUP_VERSION,exportedAt:record.exportedAt as string,
  catalog,watchedVideoIds:watched,readVideoIds:read,mutedChannelIds:muted,
  inboxBaseline:record.inboxBaseline as string,queue:q,progress:p,
  preferences:{center,filters:filterSettings,notificationGroups}
 };
 return {data,preview:{format:"full",channels:catalog.channels.length,groups:catalog.groups.length,
  queue:q.length,watched:watched.length,read:read.length,muted:muted.length,progress:p.length,
  filters:Object.keys(filterSettings).length,
  notice:"Tam kişisel yedek: mevcut kanallar, gruplar, kuyruk, izleme ve okunma verileri bu dosyayla değiştirilecek. Video önbelleği sıfırlanacak."}};
}
export function buildPersonalBackup(data:Omit<PersonalBackup,"kind"|"version"|"exportedAt">):PersonalBackup{
 const stamp=new Date().toISOString();
 return {kind:BACKUP_KIND,version:BACKUP_VERSION,exportedAt:stamp,...data};
}
