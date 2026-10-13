import type {SmartFilter,SmartVideo} from "./smart-types";
export const DEFAULT_FILTER:SmartFilter={
 query:"",channelId:"",days:0,kind:"all",read:"all",
 watched:"all",sort:"newest"
};
export function isUnread(publishedAt:string,baseline:string,read:boolean,watched:boolean):boolean{
 const publication=Date.parse(publishedAt),start=Date.parse(baseline);
 return !read&&!watched&&Number.isFinite(publication)&&Number.isFinite(start)&&publication>start;
}
export function selectVideos(items:SmartVideo[],filter:SmartFilter,now=Date.now()):SmartVideo[]{
 const term=filter.query.trim().toLocaleLowerCase("tr");
 const cutoff=filter.days===0?0:now-filter.days*86400000;
 const result=items.filter(v=>
  (filter.kind==="all"||v.kind===filter.kind)&&
  (filter.channelId===""||v.channelId===filter.channelId)&&
  (filter.read==="all"||(filter.read==="unread"?v.unread:!v.unread))&&
  (filter.watched==="all"||(filter.watched==="watched"?v.watched:!v.watched))&&
  (!cutoff||Date.parse(v.publishedAt)>=cutoff)&&
  (!term||(v.title+" "+v.channelTitle).toLocaleLowerCase("tr").includes(term))
 );
 return result.sort((a,b)=>filter.sort==="channel"
  ?a.channelTitle.localeCompare(b.channelTitle,"tr")||b.publishedAt.localeCompare(a.publishedAt)
  :filter.sort==="oldest"?a.publishedAt.localeCompare(b.publishedAt)
  :b.publishedAt.localeCompare(a.publishedAt));
}
export function validateFilter(raw:unknown):SmartFilter{
 if(!raw||typeof raw!=="object")return {...DEFAULT_FILTER};
 const data=raw as Partial<SmartFilter>;
 const oneOf=<T extends string|number>(value:unknown,allowed:readonly T[],fallback:T):T=>
  allowed.includes(value as T)?value as T:fallback;
 return {
  query:typeof data.query==="string"?data.query.slice(0,160):"",
  channelId:typeof data.channelId==="string"?data.channelId.slice(0,100):"",
  days:oneOf(data.days,[0,1,7,30],0),
  kind:oneOf(data.kind,["all","video","short","live","unknown"],"all"),
  read:oneOf(data.read,["all","unread","read"],"all"),
  watched:oneOf(data.watched,["all","watched","unwatched"],"all"),
  sort:oneOf(data.sort,["newest","oldest","channel"],"newest")
 };
}
