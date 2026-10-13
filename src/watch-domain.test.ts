import {describe,it,expect} from "vitest";
import {addToQueue,moveInQueue,progressFor,resumeUrl,videoIsValid} from "./watch-domain";
import type {VideoItem} from "./video-types";

const video:VideoItem={
 id:"AbCdEf12345",channelId:"UC"+"a".repeat(22),channelTitle:"Örnek kanal",
 title:"Birinci video",publishedAt:"2026-10-13T12:00:00.000Z",
 kind:"video",thumbnail:"https://i.ytimg.com/vi/AbCdEf12345/hqdefault.jpg",
 url:"https://www.youtube.com/watch?v=AbCdEf12345"
};
const other:VideoItem={...video,id:"YzXwVu12345",title:"İkinci",
 thumbnail:"https://i.ytimg.com/vi/YzXwVu12345/hqdefault.jpg",
 url:"https://www.youtube.com/watch?v=YzXwVu12345"};
describe("Watch queue",()=>{
 it("validates and deduplicates added video snapshots",()=>{
  const first=addToQueue([],video);
  expect(first).toHaveLength(1);
  expect(addToQueue(first,video)).toBe(first);
  expect(first[0]?.addedAt).toBeDefined();
  expect(videoIsValid({...video,url:"https://evil.example"})).toBe(false);
 });
 it("moves items without changing source order",()=>{
  const initial=addToQueue(addToQueue([],video),other);
  const moved=moveInQueue(initial,other.id,0);
  expect(moved.map(x=>x.id)).toEqual([other.id,video.id]);
  expect(initial.map(x=>x.id)).toEqual([video.id,other.id]);
  expect(()=>moveInQueue(initial,"Invalid9999",1)).toThrow();
  expect(()=>moveInQueue(initial,video.id,2)).toThrow();
 });
 it("limits queue size to 300 entries",()=>{
  const full=Array.from({length:300},(_,i)=>({...video,id:"A"+String(i).padStart(10,"0"),addedAt:"2026-10-13T00:00:00Z"}));
  expect(()=>addToQueue(full,other)).toThrow(/300/);
 });
});
describe("Local playback progress",()=>{
 it("preserves partial progress and a safe resume link",()=>{
  const part=progressFor(video.id,65,600);
  expect(part.completed).toBe(false);
  expect(part.position).toBe(65);
  expect(resumeUrl(video,part)).toBe("https://www.youtube.com/watch?v="+video.id+"&t=62s");
 });
 it("marks completed near the end instead of after 25 percent",()=>{
  expect(progressFor(video.id,180,600).completed).toBe(false);
  expect(progressFor(video.id,550,600).completed).toBe(true);
  expect(progressFor(video.id,95,100).completed).toBe(true);
  expect(resumeUrl(video,progressFor(video.id,95,100))).toBe("https://www.youtube.com/watch?v="+video.id);
 });
 it("rejects impossible and nonfinite progress",()=>{
  expect(()=>progressFor(video.id,30,0)).toThrow();
  expect(()=>progressFor(video.id,Infinity,300)).toThrow();
  expect(()=>progressFor(video.id,-10,300)).toThrow();
  expect(()=>progressFor(video.id,3010,300)).toThrow();
  expect(()=>progressFor("not a video",10,100)).toThrow();
 });
});
