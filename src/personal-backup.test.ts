import {describe,it,expect} from "vitest";
import {addGroup,emptyCatalog} from "./groups";
import {importChannels,setMembership} from "./channels";
import {BACKUP_KIND,BACKUP_VERSION,buildPersonalBackup,parsePersonalBackup} from "./personal-backup-domain";
import {DEFAULT_CENTER} from "./center-domain";
import {normalizeNotifications} from "./center-domain";
import type {VideoItem} from "./video-types";
const channelId="UC"+"x".repeat(22),videoId="abcdEF12345";
const video:VideoItem={
 id:videoId,channelId,channelTitle:"Bir kanal",title:"Bir video",
 publishedAt:"2026-10-13T12:00:00.000Z",kind:"video",
 thumbnail:"https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg",
 url:"https://www.youtube.com/watch?v="+videoId
};
function catalog(){
 let c=importChannels(emptyCatalog(),[{id:channelId,title:"Bir kanal"}]);
 c=addGroup(c,"group-id","AI",null);
 c=setMembership(c,"group-id",[channelId],true);
 return c;
}
function full(){
 const c=catalog();
 return buildPersonalBackup({catalog:c,watchedVideoIds:[videoId],readVideoIds:[videoId],
  mutedChannelIds:[channelId],inboxBaseline:"2026-10-12T00:00:00Z",
  queue:[{...video,addedAt:"2026-10-13T13:00:00Z"}],
  progress:[{videoId,position:50,duration:300,completed:false,updatedAt:"2026-10-13T14:00:00Z"}],
  preferences:{
   center:{...DEFAULT_CENTER,pinnedGroupIds:["group-id"]},
   filters:{"smartFilter:v1:feed:group-id":{query:"video",channelId:"",kind:"all",days:7,read:"unread",watched:"all",sort:"newest"}},
   notificationGroups:normalizeNotifications({enabled:true,groupIds:["group-id"],
    enabledAt:"2026-10-13T13:00:00Z",seenIdsByGroup:{"group-id":[videoId]}},new Set(["group-id"]))
  }
 });
}
describe("complete TubeShelf personal backup",()=>{
 it("exports versioned package and preserves personal data",()=>{
  const pack=full(),parsed=parsePersonalBackup(JSON.parse(JSON.stringify(pack)));
  expect(pack.kind).toBe(BACKUP_KIND);
  expect(pack.version).toBe(BACKUP_VERSION);
  expect(parsed.preview.format).toBe("full");
  expect(parsed.preview).toMatchObject({channels:1,groups:1,queue:1,watched:1,read:1,muted:1,progress:1,filters:1});
  expect(parsed.data.catalog.memberships).toHaveLength(1);
  expect(parsed.data.queue[0]?.id).toBe(videoId);
  expect(parsed.data.inboxBaseline).toBe("2026-10-12T00:00:00Z");
  expect(parsed.data.preferences.center.pinnedGroupIds).toEqual(["group-id"]);
  expect(parsed.data.preferences.notificationGroups.enabled).toBe(false);
  expect(parsed.data.preferences.notificationGroups.groupIds).toEqual(["group-id"]);
 });
 it("preserves old group backups without suggesting loss of modern data",()=>{
  const parsed=parsePersonalBackup(catalog());
  expect(parsed.preview.format).toBe("legacy");
  expect(parsed.preview.notice).toContain("korunacak");
  expect(parsed.data.queue).toEqual([]);
  expect(parsed.data.catalog.groups).toHaveLength(1);
 });
 it("rejects corrupted catalog and unknown future format",()=>{
  expect(()=>parsePersonalBackup({...full(),version:99})).toThrow();
  expect(()=>parsePersonalBackup({...full(),catalog:{...catalog(),groups:[{...catalog().groups[0],parentId:"group-id"}]}})).toThrow();
 });
 it("rejects duplicate or invalid queued videos",()=>{
  const pack=full();
  expect(()=>parsePersonalBackup({...pack,queue:[pack.queue[0],pack.queue[0]]})).toThrow();
  expect(()=>parsePersonalBackup({...pack,queue:[{...pack.queue[0],url:"https://evil.example"}]})).toThrow();
 });
 it("rejects invalid playback states before writing any records",()=>{
  const pack=full();
  expect(()=>parsePersonalBackup({...pack,progress:[{...pack.progress[0],position:-1}]})).toThrow();
  expect(()=>parsePersonalBackup({...pack,progress:[{...pack.progress[0],duration:0}]})).toThrow();
  expect(()=>parsePersonalBackup({...pack,progress:[pack.progress[0],pack.progress[0]]})).toThrow();
  const manual={...pack.progress[0],position:0,duration:0,completed:true};
  expect(parsePersonalBackup({...pack,progress:[manual]}).data.progress[0]?.completed).toBe(true);
 });
 it("validates watched and muted IDs",()=>{
  const pack=full();
  expect(()=>parsePersonalBackup({...pack,watchedVideoIds:["garbage"]})).toThrow();
  expect(()=>parsePersonalBackup({...pack,mutedChannelIds:["fake-channel"]})).toThrow();
  expect(parsePersonalBackup({...pack,readVideoIds:[videoId,videoId]}).data.readVideoIds).toEqual([videoId]);
 });
 it("drops filters referring to a deleted group",()=>{
  const pack=full();
  const parsed=parsePersonalBackup({...pack,preferences:{...pack.preferences,
   filters:{"smartFilter:v1:feed:unknown":pack.preferences.filters["smartFilter:v1:feed:group-id"]}}});
  expect(parsed.data.preferences.filters).toEqual({});
 });
 it("rejects malformed saved filter keys",()=>{
  const pack=full();
  expect(()=>parsePersonalBackup({...pack,preferences:{...pack.preferences,filters:{"__proto__:hack":{}}}})).toThrow();
 });
});
