import {describe,expect,it} from "vitest";
import {DEFAULT_FILTER,isUnread,selectVideos,validateFilter} from "./smart-domain";
import {chooseRefreshChannels} from "./smart-service";
import type {SmartVideo} from "./smart-types";
import type {ChannelVideoCache} from "./video-types";
import type {Channel} from "./types";
const id="UC"+"x".repeat(22);
const other="UC"+"y".repeat(22);
const channel:Channel={id,title:"Bir",subscribed:true};
const second:Channel={id:other,title:"İki",subscribed:true};
const video=(id:string,overrides:Partial<SmartVideo>={}):SmartVideo=>({
 id,channelId:channel.id,channelTitle:"Test Kanal",title:"Eğitim video",
 publishedAt:"2026-10-13T12:00:00.000Z",kind:"video",watched:false,read:false,
 unread:true,thumbnail:"https://i.ytimg.com/vi/x/hqdefault.jpg",
 url:"https://www.youtube.com/watch?v="+id,...overrides
});
describe("Smart Feed boundaries",()=>{
 it("does not mark historical videos as new at first activation",()=>{
  const baseline="2026-10-13T14:00:00Z";
  expect(isUnread("2026-10-13T10:00:00Z",baseline,false,false)).toBe(false);
  expect(isUnread("2026-10-13T15:00:00Z",baseline,false,false)).toBe(true);
  expect(isUnread("2026-10-13T15:00:00Z",baseline,true,false)).toBe(false);
  expect(isUnread("2026-10-13T15:00:00Z",baseline,false,true)).toBe(false);
  expect(isUnread("invalid",baseline,false,false)).toBe(false);
 });
 it("filters channel, date, type, unread, watched, query and sorts without mutating",()=>{
  const a=video("ABCabcdef01");
  const b=video("ABCabcdef02",{channelId:other,channelTitle:"İkinci",title:"Teknoloji",
   kind:"short",read:true,unread:false,publishedAt:"2026-10-11T08:00:00Z"});
  const c=video("ABCabcdef03",{kind:"live",watched:true,unread:false,publishedAt:"2026-10-12T12:00:00Z"});
  const original=[b,c,a],snapshot=original.map(x=>x.id);
  expect(selectVideos(original,{...DEFAULT_FILTER,read:"unread"}).map(x=>x.id)).toEqual([a.id]);
  expect(selectVideos(original,{...DEFAULT_FILTER,channelId:other}).map(x=>x.id)).toEqual([b.id]);
  expect(selectVideos(original,{...DEFAULT_FILTER,kind:"short"}).map(x=>x.id)).toEqual([b.id]);
  expect(selectVideos(original,{...DEFAULT_FILTER,watched:"watched"}).map(x=>x.id)).toEqual([c.id]);
  expect(selectVideos(original,{...DEFAULT_FILTER,query:"teknoloji"}).map(x=>x.id)).toEqual([b.id]);
  expect(selectVideos(original,{...DEFAULT_FILTER,days:1},Date.parse("2026-10-13T14:00:00Z")).map(x=>x.id)).toEqual([a.id]);
  expect(selectVideos(original,{...DEFAULT_FILTER,sort:"oldest"}).map(x=>x.id)).toEqual([b.id,c.id,a.id]);
  expect(original.map(x=>x.id)).toEqual(snapshot);
 });
 it("validates settings restored from storage",()=>{
  expect(validateFilter({kind:"bad",sort:"invalid",days:999,query:"A".repeat(300)})).toMatchObject({
   kind:"all",sort:"newest",days:0,query:"A".repeat(160)
  });
  expect(validateFilter(null)).toEqual(DEFAULT_FILTER);
 });
});
describe("bounded feed refresh",()=>{
 const time=Date.parse("2026-10-13T18:00:00Z");
 const cache=(id:string,updatedAt:string,attemptedAt=updatedAt,failures=0):ChannelVideoCache=>({
  channelId:id,updatedAt,attemptedAt,consecutiveFailures:failures,videos:[]
 });
 it("respects fresh cache unless user requests a forced refresh",()=>{
  const entries=new Map([[id,cache(id,"2026-10-13T17:55:00Z")]]);
  expect(chooseRefreshChannels([channel],entries,false,time)).toEqual([]);
  expect(chooseRefreshChannels([channel],entries,true,time)).toEqual([channel]);
 });
 it("backs off failing channels including forced refresh",()=>{
  const entries=new Map([[id,cache(id,"","2026-10-13T17:58:30Z",2)]]);
  expect(chooseRefreshChannels([channel],entries,true,time)).toEqual([]);
  expect(chooseRefreshChannels([channel],entries,true,time+5*60*1000)).toEqual([channel]);
 });
 it("prioritizes never-attempted and oldest channels",()=>{
  const entries=new Map([[id,cache(id,"2026-10-13T16:00:00Z")]]);
  expect(chooseRefreshChannels([channel,second],entries,true,time).map(x=>x.id)).toEqual([other,id]);
 });
});
