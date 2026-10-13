import type {VideoFeedItem} from "./video-types";
export interface VideoFilters {
 query:string;hideShorts:boolean;hideLive:boolean;hideWatched:boolean;
 days:0|7|30;
}
export function filterVideos(items:VideoFeedItem[],filters:VideoFilters,clock=Date.now()):VideoFeedItem[]{
 const query=filters.query.trim().toLocaleLowerCase("tr");
 const from=filters.days===0?0:clock-filters.days*86400000;
 return items.filter(video=>{
  if(filters.hideShorts&&video.kind==="short")return false;
  if(filters.hideLive&&video.kind==="live")return false;
  if(filters.hideWatched&&video.watched)return false;
  if(from&&Date.parse(video.publishedAt)<from)return false;
  return !query||video.title.toLocaleLowerCase("tr").includes(query)||
   video.channelTitle.toLocaleLowerCase("tr").includes(query);
 });
}
export function formatVideoDate(iso:string):string {
 const timestamp=Date.parse(iso);
 return Number.isNaN(timestamp)?"Tarih bilinmiyor":
  new Date(timestamp).toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"});
}
