import {describe,it,expect} from "vitest";
import {parseCsv,parseTakeoutCsv} from "./csv";
import {emptyCatalog,addGroup,renameGroup,deleteGroup,moveGroup,groupChannelCounts,channelsInGroup} from "./groups";
import {importChannels,setMembership} from "./channels";
import {validateBackup} from "./backup";
const id1="UC"+"a".repeat(22),id2="UC"+"b".repeat(22);
describe("Google Takeout parser",()=>{
 it("handles BOM, quotes, commas, newlines and CRLF",()=>{
  const rows=parseCsv("\uFEFFChannel Id,Channel Title\r\n"+id1+",\"Demo, Kanal\"\r\n"+id2+",\"İki\nSatır\"");
  expect(rows[1]?.[1]).toBe("Demo, Kanal");
  expect(rows[2]?.[1]).toBe("İki\nSatır");
 });
 it("deduplicates channel ids and ignores bad rows",()=>{
  const result=parseTakeoutCsv("Channel Id,Channel Url,Channel Title\n"+id1+",https://www.youtube.com/channel/"+id1+",Başlık\n"+id1+",,Yine\nBAD,,Hatalı");
  expect(result.channels).toHaveLength(1);expect(result.ignored).toBe(2);
 });
 it("rejects wrong header",()=>expect(()=>parseTakeoutCsv("wrong,columns\na,b")).toThrow());
});
describe("catalog invariants",()=>{
 it("keeps multiple group memberships and reparented children",()=>{
  let c=emptyCatalog();
  c=importChannels(c,[{id:id1,title:"Bir"},{id:id2,title:"İki"}]);
  c=addGroup(c,"parent","Eğitim",null);
  c=addGroup(c,"child","Video","parent");
  c=setMembership(c,"parent",[id1],true);
  c=setMembership(c,"child",[id1,id2],true);
  expect(channelsInGroup(c,"parent").size).toBe(2);
  c=deleteGroup(c,"parent");
  expect(c.groups.find(g=>g.id==="child")?.parentId).toBeNull();
  expect(c.memberships).toHaveLength(2);
 });
 it("preserves organization when sync removes subscription",()=>{
  let c=importChannels(emptyCatalog(),[{id:id1,title:"Bir"},{id:id2,title:"İki"}]);
  c=addGroup(c,"g","G",null);c=setMembership(c,"g",[id1],true);
  c=importChannels(c,[{id:id2,title:"İki yeni"}],true);
  expect(c.channels.find(ch=>ch.id===id1)?.subscribed).toBe(false);
  expect(c.memberships).toHaveLength(1);
  expect(c.channels.find(ch=>ch.id===id2)?.title).toBe("İki yeni");
 });
 it("rejects duplicate sibling names",()=>{
  const c=addGroup(emptyCatalog(),"a","Eğitim",null);
  expect(()=>addGroup(c,"b","eğitim",null)).toThrow();
  expect(()=>renameGroup(c,"a","")).toThrow();
 });
 it("validates backup and rejects cycles",()=>{
  const c=addGroup(emptyCatalog(),"a","A",null);
  expect(validateBackup(JSON.parse(JSON.stringify(c))).groups).toHaveLength(1);
  expect(()=>validateBackup({...c,groups:[{...c.groups[0],parentId:"a"}]})).toThrow();
 });
});

describe("group moves and scalable counts",()=>{
 it("moves nested groups without losing memberships",()=>{
  let c=importChannels(emptyCatalog(),[{id:id1,title:"Bir"},{id:id2,title:"İki"}]);
  c=addGroup(c,"a","A",null);c=addGroup(c,"b","B",null);c=addGroup(c,"child","Alt","a");
  c=setMembership(c,"a",[id1],true);
  c=setMembership(c,"child",[id1,id2],true);
  expect(groupChannelCounts(c).get("a")).toBe(2);
  c=moveGroup(c,"child","b");
  expect(groupChannelCounts(c).get("a")).toBe(1);
  expect(groupChannelCounts(c).get("b")).toBe(2);
  expect(c.memberships).toHaveLength(3);
  expect(()=>moveGroup(c,"b","child")).toThrow();
  c=moveGroup(c,"child",null);
  expect(c.groups.find(g=>g.id==="child")?.parentId).toBeNull();
 });
 it("rejects sibling name collisions when moving",()=>{
  let c=addGroup(emptyCatalog(),"a","Kategori",null);
  c=addGroup(c,"b","Başka",null);
  c=addGroup(c,"sub","Kategori","b");
  expect(()=>moveGroup(c,"sub",null)).toThrow();
 });
});

import {channelRefFromUrl,channelUrl,isChannelRef} from "./channel-ref";
import {extractChannel} from "./direct-import";
describe("Direct YouTube import",()=>{
 const handle="handle:Türkçe_123";
 it("accepts canonical IDs and international handles",()=>{
  expect(isChannelRef(id1)).toBe(true);
  expect(isChannelRef(handle)).toBe(true);
  expect(isChannelRef("https://evil.example")).toBe(false);
  expect(channelRefFromUrl("https://www.youtube.com/@T%C3%BCrk%C3%A7e_123")).toBe(handle);
  expect(channelRefFromUrl("/channel/"+id1)).toBe(id1);
  expect(channelRefFromUrl("https://example.com/channel/"+id1)).toBeNull();
  expect(channelUrl(handle)).toContain("youtube.com/@T%C3%BCrk%C3%A7e_123");
 });
 it("preserves handle channels in backups",()=>{
  let c=importChannels(emptyCatalog(),[{id:handle,title:"Kanal"}]);
  c=addGroup(c,"g","G",null);
  c=setMembership(c,"g",[handle],true);
  const restored=validateBackup(JSON.parse(JSON.stringify(c)));
  expect(restored.memberships[0]?.channelId).toBe(handle);
 });
 it("extracts canonical channel identity from rendered YouTube cards",()=>{
  const link={href:"https://www.youtube.com/@ornek",textContent:"Kanalım",
    querySelector:()=>({textContent:"Kanalım"})};
  const stub={
   data:{channelId:id1},
   querySelectorAll:()=>[link],
   querySelector:(selector:string)=>selector.startsWith("a#")?link:
    selector==="img[src]"?{src:"https://i.ytimg.com/example.jpg"}:null
  } as unknown as Element;
  expect(extractChannel(stub)).toEqual({
   id:id1,title:"Kanalım",thumbnailUrl:"https://i.ytimg.com/example.jpg"
  });
 });
});
