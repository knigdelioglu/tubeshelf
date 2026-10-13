import {afterEach,describe,expect,it,vi} from "vitest";
import {loadChannelVideos} from "./video-network";
import type {Channel} from "./types";
const channel:Channel={id:"UC"+"a".repeat(22),title:"Test",subscribed:true};
function atom(id:string){
 return '<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015"><entry><yt:videoId>'+id+
 '</yt:videoId><title>Video</title><published>2026-10-13T10:00:00Z</published></entry></feed>';
}
afterEach(()=>vi.unstubAllGlobals());
describe("public YouTube feed network adapter",()=>{
 it("classifies video, Shorts and live when category feeds are available",async()=>{
  const fetchMock=vi.fn(async(url:string)=>{
   const id=url.includes("UUSH")?"Shorts00001":url.includes("UULV")?"LiveStream1":"NormalVid01";
   return new Response(atom(id),{status:200});
  });
  vi.stubGlobal("fetch",fetchMock);
  const result=await loadChannelVideos(channel);
  expect(result.videos).toHaveLength(3);
  expect(result.videos.map(v=>v.kind).sort()).toEqual(["live","short","video"]);
  expect(fetchMock).toHaveBeenCalledTimes(3);
 });
 it("falls back to regular feed when unofficial category feeds fail",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.includes("channel_id=")?
   new Response(atom("Fallback123"),{status:200}):
   new Response("not found",{status:404})));
  const result=await loadChannelVideos(channel);
  expect(result.videos).toHaveLength(1);
  expect(result.videos[0]?.kind).toBe("unknown");
  expect(result.error).toContain("video");
 });
 it("preserves valid cached records on a total upstream failure",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>new Response("blocked",{status:503})));
  const previous={
   channelId:channel.id,updatedAt:"2026-10-12T00:00:00Z",
   videos:[{id:"Previous001",title:"Old",channelId:channel.id,channelTitle:"Test",
    publishedAt:"2026-10-12T00:00:00Z",kind:"video" as const,
    thumbnail:"https://i.ytimg.com/vi/Previous001/hqdefault.jpg",url:"https://www.youtube.com/watch?v=Previous001"}]
  };
  const result=await loadChannelVideos(channel,previous);
  expect(result.videos).toHaveLength(1);
  expect(result.updatedAt).toBe(previous.updatedAt);
  expect(result.error).toMatch(/HTTP 503/);
 });
});

describe("Partial feed retention",()=>{
 it("keeps recent older cards when a refresh only returns a partial feed",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.includes("channel_id=")?
   new Response(atom("Fallback123"),{status:200}):
   new Response("not found",{status:404})));
  const past=new Date(Date.now()-6*86400000).toISOString();
  const previous={
   channelId:channel.id,updatedAt:past,
   videos:[{id:"Previous001",title:"Previous short",channelId:channel.id,channelTitle:"Test",
    publishedAt:past,kind:"short" as const,
    thumbnail:"https://i.ytimg.com/vi/Previous001/hqdefault.jpg",
    url:"https://www.youtube.com/shorts/Previous001"}]
  };
  const result=await loadChannelVideos(channel,previous);
  expect(result.videos.map(x=>x.id).sort()).toEqual(["Fallback123","Previous001"].sort());
  expect(result.videos.find(x=>x.id==="Previous001")?.kind).toBe("short");
  expect(result.error).toContain("doğrulanamadı");
 });
 it("does not retain content beyond the bounded retention period",async()=>{
  vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.includes("channel_id=")?
   new Response(atom("Fallback123"),{status:200}):
   new Response("not found",{status:404})));
  const old=new Date(Date.now()-60*86400000).toISOString();
  const previous={channelId:channel.id,updatedAt:old,videos:[
   {id:"Previous001",title:"Old",channelId:channel.id,channelTitle:"Test",publishedAt:old,
    kind:"video" as const,thumbnail:"https://i.ytimg.com/vi/Previous001/hqdefault.jpg",
    url:"https://www.youtube.com/watch?v=Previous001"}]};
  const result=await loadChannelVideos(channel,previous);
  expect(result.videos.map(x=>x.id)).toEqual(["Fallback123"]);
 });
});
