import {describe,expect,it} from "vitest";
import {createBoundedWorkQueue} from "./refresh-coordinator";
import {boundedText} from "./video-network";
import {chooseRefreshChannels} from "./smart-service";
import type {Channel} from "./types";
import type {ChannelVideoCache} from "./video-types";

describe("Globally bounded refresh queue",()=>{
 it("deduplicates simultaneous requests for the same channel",async()=>{
  const queue=createBoundedWorkQueue<number>(2);
  let calls=0;
  const a=queue.run("channel-a",async()=>{calls++;return 7;});
  const b=queue.run("channel-a",async()=>{calls++;return 7;});
  expect(a).toBe(b);
  expect(await Promise.all([a,b])).toEqual([7,7]);
  expect(calls).toBe(1);
 });
 it("never exceeds its concurrency budget on 100 channel requests",async()=>{
  const queue=createBoundedWorkQueue<number>(3);
  let running=0,maximum=0;
  const results=await Promise.all(Array.from({length:100},(_,i)=>queue.run("channel-"+i,async()=>{
   running++;maximum=Math.max(maximum,running);
   await Promise.resolve();await Promise.resolve();
   running--;return i;
  })));
  expect(maximum).toBeLessThanOrEqual(3);
  expect(results).toEqual(Array.from({length:100},(_,i)=>i));
 });
 it("releases a failed job so the next channel can proceed",async()=>{
  const queue=createBoundedWorkQueue<string>(1);
  const bad=queue.run("failing",async()=>{throw new Error("offline");});
  const good=queue.run("next",async()=>"success");
  await expect(bad).rejects.toThrow("offline");
  await expect(good).resolves.toBe("success");
 });
 it("does not conflate fetches across restore epochs",async()=>{
  const queue=createBoundedWorkQueue<string>(2);
  expect(await Promise.all([
   queue.run("epoch-1:channel",async()=>"old"),
   queue.run("epoch-2:channel",async()=>"new")
  ])).toEqual(["old","new"]);
 });
});

describe("Bounded YouTube response parsing",()=>{
 it("parses small streamed Atom responses",async()=>{
  const xml="<feed><entry>test</entry></feed>";
  expect(await boundedText(new Response(xml),4096)).toBe(xml);
 });
 it("rejects oversized streamed data before completing a response",async()=>{
  await expect(boundedText(new Response("x".repeat(1024)),256)).rejects.toThrow(/boyut sınırı/);
 });
 it("rejects oversized content-length without reading the body",async()=>{
  const response=new Response("OK",{headers:{"content-length":"9000000"}});
  await expect(boundedText(response,1024)).rejects.toThrow(/boyut sınırı/);
 });
 it("handles multibyte UTF-8 data without breaking text",async()=>{
  const value="İstanbul Şiir 🎥";
  expect(await boundedText(new Response(value),1000)).toBe(value);
 });
});

describe("Large subscription refresh prioritization",()=>{
 it("puts unprocessed channels before previously refreshed ones",()=>{
  const mk=(i:number):Channel=>({id:"UC"+String(i).padStart(22,"0"),title:"Kanal "+i,subscribed:true});
  const channels=Array.from({length:2000},(_,i)=>mk(i));
  const records=new Map<string,ChannelVideoCache>();
  for(let i=0;i<1000;i++){
   records.set(channels[i]!.id,{channelId:channels[i]!.id,updatedAt:"2026-10-01T00:00:00Z",
    attemptedAt:"2026-10-01T00:00:00Z",videos:[]});
  }
  const list=chooseRefreshChannels(channels,records,false,Date.parse("2026-10-13T00:00:00Z"));
  expect(list.length).toBe(2000);
  expect(list[0]?.id).toBe(channels[1000]?.id);
  expect(list.at(-1)?.id).toBe(channels[999]?.id);
 });
});
