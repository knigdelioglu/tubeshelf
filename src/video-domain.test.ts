import {describe,expect,it} from "vitest";
import {parseAtom,feedUrl,standardFeedUrl,mergeFeedKinds,findCanonicalChannelId} from "./video-rss";
import {filterVideos} from "./feed-domain";
import type {VideoFeedItem} from "./video-types";
const id="UC"+"Z".repeat(22);
const vid="AbCdEf12345";
const atom=`<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">
 <entry><yt:videoId>${vid}</yt:videoId><title>Kod &amp; Eğitim</title>
 <published>2026-10-13T12:00:00+00:00</published></entry>
 <entry><yt:videoId>invalid!</yt:videoId><title>Bad</title><published>2026-10-13T11:00:00Z</published></entry>
</feed>`;
describe("YouTube Atom videos",()=>{
 it("parses and decodes only valid video entries",()=>{
  const parsed=parseAtom(atom,id,"Test Kanal","short");
  expect(parsed).toHaveLength(1);
  expect(parsed[0]?.id).toBe(vid);
  expect(parsed[0]?.title).toBe("Kod & Eğitim");
  expect(parsed[0]?.kind).toBe("short");
  expect(parsed[0]?.url).toBe("https://www.youtube.com/shorts/"+vid);
  expect(parsed[0]?.publishedAt).toBe("2026-10-13T12:00:00.000Z");
 });
 it("rejects non-feed responses and unsafe IDs",()=>{
  expect(()=>parseAtom("<html>not found</html>",id,"X","video")).toThrow();
  expect(()=>standardFeedUrl("not-channel")).toThrow();
  expect(feedUrl(id,"live")).toContain("playlist_id=UULV");
  expect(feedUrl(id,"short")).toContain("playlist_id=UUSH");
  expect(feedUrl(id,"video")).toContain("playlist_id=UULF");
 });
 it("merges duplicates and upgrades classifications without losing date",()=>{
  const unknown=parseAtom(atom,id,"X","unknown");
  const shorts=parseAtom(atom,id,"X","short");
  expect(mergeFeedKinds([unknown,shorts])[0]?.kind).toBe("short");
  expect(mergeFeedKinds([shorts,unknown])).toHaveLength(1);
 });
 it("recognizes public channel identities embedded in handle HTML",()=>{
  expect(findCanonicalChannelId('<link href="https://www.youtube.com/feeds/videos.xml?channel_id='+id+'">')).toBe(id);
  expect(findCanonicalChannelId('{"externalId":"'+id+'"}')).toBe(id);
  expect(findCanonicalChannelId("<html>blocked</html>")).toBeNull();
 });
 it("applies independent kind, watched, text and date filters",()=>{
  const base=parseAtom(atom,id,"Channel","short")[0]!;
  const list:VideoFeedItem[]=[{...base,watched:false},{...base,id:"Qwerty12345",kind:"video",watched:true},
   {...base,id:"Qwerty12346",kind:"live",watched:false}];
  expect(filterVideos(list,{query:"",hideShorts:true,hideLive:true,hideWatched:true,days:0})).toHaveLength(0);
  expect(filterVideos(list,{query:"Eğitim",hideShorts:true,hideLive:false,hideWatched:true,days:0})).toHaveLength(1);
  expect(filterVideos(list,{query:"unrelated",hideShorts:false,hideLive:false,hideWatched:false,days:0})).toHaveLength(0);
 });
});
