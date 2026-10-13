export interface Channel { id:string; title:string; subscribed:boolean; thumbnailUrl?:string; lastSeenAt?:string }
export interface ChannelInput { id:string; title:string; thumbnailUrl?:string }
export interface Group { id:string; name:string; parentId:string|null; createdAt:string }
export interface Membership { groupId:string; channelId:string }
export interface Catalog { schemaVersion:1; revision:number; updatedAt:string; lastSyncedAt?:string; channels:Channel[]; groups:Group[]; memberships:Membership[] }
export type Request =
| {type:"CATALOG_GET"}
| {type:"CATALOG_IMPORT";channels:ChannelInput[]}
| {type:"GROUP_CREATE";name:string;parentId:string|null}
| {type:"GROUP_RENAME";id:string;name:string}
| {type:"GROUP_DELETE";id:string}
| {type:"MEMBERSHIP_SET";groupId:string;channelIds:string[];enabled:boolean}
| {type:"CATALOG_RESTORE";backup:unknown}
| {type:"SUBSCRIPTIONS_SYNC"}
| {type:"OPEN_DASHBOARD";groupId?:string};
export type Response = {ok:true;catalog:Catalog}|{ok:false;error:string};