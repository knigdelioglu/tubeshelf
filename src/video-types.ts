/** Public YouTube Atom feed model. No account tokens are stored. */
export type VideoKind="video"|"short"|"live"|"unknown";
export interface VideoItem {
 id:string;channelId:string;channelTitle:string;title:string;
 publishedAt:string;kind:VideoKind;thumbnail:string;url:string;
}
export interface ChannelVideoCache {
 channelId:string;updatedAt:string;videos:VideoItem[];canonicalId?:string;
 error?:string;
}
export interface VideoFeedItem extends VideoItem {watched:boolean}
export interface FeedSnapshot {
 videos:VideoFeedItem[];totalChannels:number;loadedChannels:number;
 failedChannels:number;updatedAt?:string;errors:string[];
}
export type VideoRequest =
 | {type:"VIDEO_GET";groupId:string|null}
 | {type:"VIDEO_REFRESH";groupId:string|null;force?:boolean}
 | {type:"VIDEO_WATCHED_SET";videoId:string;watched:boolean};
export type VideoResponse =
 | {ok:true;feed:FeedSnapshot}
 | {ok:true;watched:boolean}
 | {ok:false;error:string};
