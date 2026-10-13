import type {VideoFeedItem} from "./video-types";

export interface SmartVideo extends VideoFeedItem {read:boolean;unread:boolean}
export interface SmartState {
 baseline:string;readIds:string[];mutedChannelIds:string[];
}
export interface SmartFeed {
 videos:SmartVideo[];
 totalChannels:number;loadedChannels:number;failedChannels:number;
 updatedAt?:string;errors:string[];unreadCount:number;
 mutedChannelIds:string[];pendingChannels:number;
 lastBatch?:{attempted:number;remaining:number};
}
export type SmartVideoRequest =
 | {type:"SMART_FEED_GET";groupId:string|null}
 | {type:"SMART_FEED_REFRESH";groupId:string|null;force?:boolean}
 | {type:"SMART_READ_SET";videoId:string;read:boolean}
 | {type:"SMART_READ_ALL";groupId:string|null}
 | {type:"SMART_MUTE_SET";channelId:string;muted:boolean};
export type SmartVideoResponse =
 | {ok:true;feed:SmartFeed}
 | {ok:true;changed:number}
 | {ok:false;error:string};
export type SmartFilter={
 query:string;channelId:string;days:0|1|7|30;
 kind:"all"|"video"|"short"|"live"|"unknown";
 read:"all"|"unread"|"read";
 watched:"all"|"watched"|"unwatched";
 sort:"newest"|"oldest"|"channel";
};
