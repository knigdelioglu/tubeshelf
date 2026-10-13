import type {Catalog,Channel} from "./types";
import type {ChannelVideoCache,VideoItem} from "./video-types";
import type {CenterPreferences,CenterAnalytics,ChannelActivity,GroupSuggestion,GroupNotificationConfig} from "./center-types";
import {channelsInGroup} from "./groups";

export const DEFAULT_CENTER:CenterPreferences={
 pinnedGroupIds:[],columns:2,videosPerGroup:6,showUnpinned:true
};
export function normalizeCenterPrefs(raw:unknown,catalog:Catalog):CenterPreferences{
 const r=raw&&typeof raw==="object"?raw as Partial<CenterPreferences>:{};
 const valid=new Set(catalog.groups.map(g=>g.id));
 const pinned=Array.isArray(r.pinnedGroupIds)?r.pinnedGroupIds.filter((id):id is string=>typeof id==="string"&&valid.has(id)):[];
 return {pinnedGroupIds:[...new Set(pinned)].slice(0,200),
  columns:r.columns===1||r.columns===2||r.columns===3?r.columns:2,
  videosPerGroup:r.videosPerGroup===3||r.videosPerGroup===6||r.videosPerGroup===9?r.videosPerGroup:6,
  showUnpinned:typeof r.showUnpinned==="boolean"?r.showUnpinned:true};
}
export function orderedGroups(catalog:Catalog,prefs:CenterPreferences):string[]{
 const available=catalog.groups.map(g=>g.id),set=new Set(available);
 const pinned=prefs.pinnedGroupIds.filter(id=>set.has(id));
 return prefs.showUnpinned?[...pinned,...available.filter(id=>!pinned.includes(id))]:pinned;
}

const STOP=new Set(["kanal","youtube","resmi","official","the","video","videolar","ve","bir","ile","for","and","tv","tr"]);
function words(raw:string):Set<string>{
 return new Set(raw.toLocaleLowerCase("tr").normalize("NFKC").split(/[^\p{L}\p{N}]+/u)
  .map(s=>s.trim()).filter(s=>(s.length>=3||s==="ai")&&!STOP.has(s)));
}
const THEMES:Record<string,string[]>={
 "teknoloji":["teknoloji","tech","bilgisayar","software","programlama","yazılım","coding","donanım","apple","android","linux"],
 "yapay zeka":["yapay","zeka","ai","llm","model","machine","learning","gpt","artificial","intelligence"],
 "edebiyat":["edebiyat","şiir","roman","kitap","yazar","poetry","literature","şair","okuma"],
 "eğitim":["eğitim","öğretmen","ders","okul","education","learning","sınav","konu","akademi"],
 "haber":["haber","news","gündem","ekonomi","politika","finans","finance"],
 "oyun":["oyun","gaming","game","playstation","xbox","steam","ps5"],
 "bilim":["bilim","science","uzay","fizik","astronomi","space","nasa"],
 "müzik":["müzik","music","şarkı","konser","gitar","piyano"]
};
function matchScore(channelText:string,groupText:string):{score:number;reason:string}{
 const ch=words(channelText),gr=words(groupText);
 const overlap=[...gr].filter(x=>ch.has(x));
 if(overlap.length)return {score:Math.min(100,70+overlap.length*10),reason:"Kanal adı ve grup adı ortak kelimeler içeriyor"};
 const relevant=Object.entries(THEMES).filter(([label,terms])=>{
  const labelTerms=words(label);
  return [...labelTerms].some(x=>gr.has(x))||terms.some(x=>gr.has(x));
 });
 for(const [,terms] of relevant){
  if(terms.some(x=>ch.has(x)))return {score:60,reason:"Kanal adı, grubun konusu ile ilişkili"};
 }
 return {score:0,reason:""};
}
export function suggestGroups(catalog:Catalog,caches:ChannelVideoCache[],limit=50):GroupSuggestion[]{
 const byCache=new Map(caches.map(c=>[c.channelId,c]));
 const membership=new Set(catalog.memberships.map(m=>m.groupId+"\0"+m.channelId));
 const recommendations:GroupSuggestion[]=[];
 for(const channel of catalog.channels){
  if(!channel.subscribed)continue;
  const titles=byCache.get(channel.id)?.videos.slice(0,3).map(v=>v.title).join(" ")??"";
  for(const group of catalog.groups){
   if(membership.has(group.id+"\0"+channel.id))continue;
   const direct=matchScore(channel.title,group.name);
   const content=titles?matchScore(titles,group.name):{score:0,reason:""};
   const selected=direct.score>=content.score?direct:
     {...content,score:Math.min(content.score,65),reason:"Son video başlıkları bu grupla ilişkili"};
   if(selected.score>=60)recommendations.push({
    channelId:channel.id,channelTitle:channel.title,groupId:group.id,groupName:group.name,
    score:selected.score,explanation:selected.reason});
  }
 }
 return recommendations.sort((a,b)=>b.score-a.score||a.channelTitle.localeCompare(b.channelTitle,"tr")).slice(0,limit);
}
export function analyzeChannels(catalog:Catalog,caches:ChannelVideoCache[],now=Date.now()):CenterAnalytics{
 const lookup=new Map(caches.map(c=>[c.channelId,c]));
 const since=now-30*86400000;
 let sampled=0,missing=0;
 const channels:ChannelActivity[]=catalog.channels.filter(ch=>ch.subscribed).map(ch=>{
  const c=lookup.get(ch.id),videos=c?.videos??[];
  const successful=Boolean(c?.updatedAt&&Number.isFinite(Date.parse(c.updatedAt)));
  if(successful)sampled++;else missing++;
  const published=videos.map(v=>v.publishedAt).filter(d=>Number.isFinite(Date.parse(d))).sort().reverse();
  return {channelId:ch.id,title:ch.title,subscribed:true,cachedVideos:videos.length,
   videosLast30Days:videos.filter(v=>Date.parse(v.publishedAt)>=since).length,
   ...(published[0]?{newestVideoAt:published[0]}:{}),
   ...(c?.updatedAt?{lastFetchedAt:c.updatedAt}:{}),
   ...(c?.error?{sourceError:c.error}:{}),
   sourceAvailable:successful};
 });
 return {channels,sampledChannels:sampled,missingSources:missing,suggestions:suggestGroups(catalog,caches)};
}
export function eligibleNotificationVideos(videos:VideoItem[],enabledAt:string,seenIds:string[]):VideoItem[]{
 const seen=new Set(seenIds);
 return videos.filter(v=>!seen.has(v.id)&&Number.isFinite(Date.parse(v.publishedAt))&&
    Date.parse(v.publishedAt)>Date.parse(enabledAt))
  .sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
}
export function normalizeNotifications(raw:unknown,groupIds:Set<string>):GroupNotificationConfig{
 const x=raw&&typeof raw==="object"?raw as Partial<GroupNotificationConfig>:{};
 const enabledAt=typeof x.enabledAt==="string"&&Number.isFinite(Date.parse(x.enabledAt))?x.enabledAt:new Date().toISOString();
 const list=Array.isArray(x.groupIds)?[...new Set(x.groupIds.filter((id):id is string=>typeof id==="string"&&groupIds.has(id)))].slice(0,100):[];
 const seen:Record<string,string[]>={};
 for(const id of list){
  const ids=x.seenIdsByGroup?.[id];
  seen[id]=Array.isArray(ids)?[...new Set(ids.filter((v):v is string=>typeof v==="string"&&/^[A-Za-z0-9_-]{11}$/.test(v)))].slice(-1000):[];
 }
 return {enabled:x.enabled===true,groupIds:list,enabledAt,seenIdsByGroup:seen};
}
