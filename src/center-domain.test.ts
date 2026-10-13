import {describe,it,expect} from "vitest";
import {emptyCatalog,addGroup} from "./groups";
import {importChannels,setMembership} from "./channels";
import {DEFAULT_CENTER,normalizeCenterPrefs,orderedGroups,suggestGroups,analyzeChannels,normalizeNotifications,eligibleNotificationVideos} from "./center-domain";
import type {ChannelVideoCache,VideoItem} from "./video-types";
const id1="UC"+"a".repeat(22),id2="UC"+"b".repeat(22);
const now="2026-10-13T15:00:00.000Z";
const video=(id:string,channelId=id1,publishedAt=now):VideoItem=>({
 id,channelId,channelTitle:"Channel",title:"Yeni yapay zeka modeli",publishedAt,
 kind:"video",thumbnail:"https://i.ytimg.com/vi/"+id+"/hqdefault.jpg",
 url:"https://www.youtube.com/watch?v="+id
});
function catalog(){
 let c=emptyCatalog();
 c=addGroup(c,"ai","Yapay Zeka",null);
 c=addGroup(c,"edu","Edebiyat",null);
 c=addGroup(c,"child","Model","ai");
 c=importChannels(c,[{id:id1,title:"Yeni AI Modeli"},{id:id2,title:"Şiir ve Edebiyat"}]);
 return c;
}
describe("Personal center settings",()=>{
 it("validates layout, pins and removed groups",()=>{
  const c=catalog();
  const settings=normalizeCenterPrefs({
   pinnedGroupIds:["edu","ai","edu","deleted",null],columns:7,videosPerGroup:9,showUnpinned:false
  },c);
  expect(settings).toEqual({pinnedGroupIds:["edu","ai"],columns:2,videosPerGroup:9,showUnpinned:false});
  expect(orderedGroups(c,settings)).toEqual(["edu","ai"]);
  expect(orderedGroups(c,{...settings,showUnpinned:true})).toEqual(["edu","ai","child"]);
  expect(normalizeCenterPrefs(null,c)).toEqual(DEFAULT_CENTER);
 });
 it("suggests relevant group membership without mutating catalog",()=>{
  let c=catalog();
  const before=c.memberships.length;
  const suggestions=suggestGroups(c,[],20);
  expect(suggestions.some(x=>x.channelId===id1&&x.groupId==="ai")).toBe(true);
  expect(suggestions.some(x=>x.channelId===id2&&x.groupId==="edu")).toBe(true);
  expect(c.memberships).toHaveLength(before);
  c=setMembership(c,"ai",[id1],true);
  expect(suggestGroups(c,[],20).some(x=>x.channelId===id1&&x.groupId==="ai")).toBe(false);
 });
 it("reports only observed activity, never invents missing source stats",()=>{
  const c=catalog();
  const cache:ChannelVideoCache={channelId:id1,updatedAt:now,videos:[
   video("abcdef12345",id1,"2026-10-13T12:00:00.000Z"),
   video("abcdef12346",id1,"2026-06-13T12:00:00.000Z")
  ]};
  const stats=analyzeChannels(c,[cache],Date.parse(now));
  expect(stats.sampledChannels).toBe(1);
  expect(stats.missingSources).toBe(1);
  expect(stats.channels.find(x=>x.channelId===id1)?.videosLast30Days).toBe(1);
  expect(stats.channels.find(x=>x.channelId===id2)?.sourceAvailable).toBe(false);
 });
});
describe("group notification safety",()=>{
 it("defaults to disabled and strips deleted or repeated groups",()=>{
  const valid=new Set(["ai","edu"]);
  expect(normalizeNotifications(null,valid).enabled).toBe(false);
  const c=normalizeNotifications({enabled:true,groupIds:["ai","ai","removed","edu"],
    enabledAt:now,seenIdsByGroup:{ai:["abcdef12345","abcdef12345","invalid!"],edu:[]}},valid);
  expect(c.groupIds).toEqual(["ai","edu"]);
  expect(c.seenIdsByGroup.ai).toEqual(["abcdef12345"]);
 });
 it("never notifies historical items or duplicate videos",()=>{
  const items=[
   video("abcdef12345",id1,"2026-10-13T16:00:00Z"),
   video("abcdef12346",id1,"2026-10-13T13:00:00Z"),
   video("abcdef12347",id1,"2026-10-13T18:00:00Z")
  ];
  const result=eligibleNotificationVideos(items,now,["abcdef12345"]);
  expect(result.map(v=>v.id)).toEqual(["abcdef12347"]);
 });
});
