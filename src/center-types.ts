import type {Channel} from "./types";
export interface CenterPreferences {
  pinnedGroupIds:string[];
  columns:1|2|3;
  videosPerGroup:3|6|9;
  showUnpinned:boolean;
}
export interface ChannelActivity {
  channelId:string;title:string;subscribed:boolean;
  cachedVideos:number;videosLast30Days:number;
  newestVideoAt?:string;lastFetchedAt?:string;
  sourceError?:string;sourceAvailable:boolean;
}
export interface GroupSuggestion {
  channelId:string;channelTitle:string;groupId:string;groupName:string;
  score:number;explanation:string;
}
export interface CenterAnalytics {
  channels:ChannelActivity[];
  sampledChannels:number;missingSources:number;
  suggestions:GroupSuggestion[];
}
export interface GroupNotificationConfig {
  enabled:boolean;
  groupIds:string[];
  enabledAt:string;
  seenIdsByGroup:Record<string,string[]>;
}
export type CenterRequest =
 | {type:"CENTER_ANALYTICS_GET"}
 | {type:"CENTER_NOTIFICATION_GET"}
 | {type:"CENTER_NOTIFICATION_CONFIGURE";enabled:boolean;groupIds:string[]};
export type CenterResponse =
 | {ok:true;analytics:CenterAnalytics}
 | {ok:true;notifications:GroupNotificationConfig}
 | {ok:false;error:string};
