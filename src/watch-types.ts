import type {VideoItem} from "./video-types";
export interface QueuedVideo extends VideoItem {addedAt:string}
export interface PlaybackProgress {videoId:string;position:number;duration:number;updatedAt:string;completed:boolean}
export interface WatchState {queue:QueuedVideo[];progress:PlaybackProgress[]}
export type WatchRequest =
 | {type:"WATCH_GET"}
 | {type:"WATCH_QUEUE_ADD";video:VideoItem}
 | {type:"WATCH_QUEUE_REMOVE";videoId:string}
 | {type:"WATCH_QUEUE_MOVE";videoId:string;toIndex:number}
 | {type:"WATCH_QUEUE_CLEAR"}
 | {type:"WATCH_PROGRESS_SET";videoId:string;position:number;duration:number}
 | {type:"WATCH_PROGRESS_RESET";videoId:string}
 | {type:"WATCH_COMPLETE";videoId:string};
export type WatchResponse={ok:true;state:WatchState}|{ok:false;error:string};
