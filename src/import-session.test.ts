import {afterEach,describe,expect,it,vi} from "vitest";
import {handle} from "./service";

vi.mock("./db",()=>({
 readCatalog:async()=>({schemaVersion:1,revision:0,updatedAt:"2026-10-13T12:00:00Z",
  channels:[],groups:[],memberships:[]}),
 writeCatalog:async()=>undefined
}));
function mockChrome(){
 let nextId=40;
 const tabs=new Map<number,{id:number;url:string}>();
 const state:{directImportStatus?:{state:string;count:number;startedAt:number;tabId:number;token:string}}={};
 const chrome={
  storage:{local:{
   get:vi.fn(async()=>({directImportStatus:state.directImportStatus})),
   set:vi.fn(async (value:{directImportStatus?:typeof state.directImportStatus})=>{
    state.directImportStatus=value.directImportStatus;
   })
  }},
  tabs:{
   get:vi.fn(async (id:number)=>{
    const tab=tabs.get(id);
    if(!tab)throw new Error("No such tab");
    return tab;
   }),
   create:vi.fn(async (options:{url:string})=>{
    const tab={id:++nextId,url:options.url};tabs.set(tab.id,tab);return tab;
   })
  }
 };
 vi.stubGlobal("chrome",chrome);
 return {chrome,state,tabs};
}
afterEach(()=>vi.unstubAllGlobals());
describe("Direct YouTube import session recovery",()=>{
 it("starts a fresh import if the prior YouTube tab no longer exists",async()=>{
  const {chrome,state}=mockChrome();
  state.directImportStatus={state:"scanning",count:25,startedAt:Date.now(),tabId:999,token:"stale"};
  await expect(handle({type:"DIRECT_IMPORT_START"})).resolves.toBeDefined();
  expect(chrome.tabs.get).toHaveBeenCalledWith(999);
  expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  expect(state.directImportStatus?.state).toBe("opening");
  expect(state.directImportStatus?.tabId).not.toBe(999);
 });
 it("keeps a valid active import and avoids opening a duplicate tab",async()=>{
  const {chrome,state,tabs}=mockChrome();
  const tabId=18;
  tabs.set(tabId,{id:tabId,url:"https://www.youtube.com/feed/channels"});
  state.directImportStatus={state:"opening",count:0,startedAt:Date.now(),tabId,token:"live"};
  await expect(handle({type:"DIRECT_IMPORT_START"})).rejects.toThrow(/zaten devam/);
  expect(chrome.tabs.create).not.toHaveBeenCalled();
 });
 it("treats a prior tab that navigated elsewhere as abandoned",async()=>{
  const {chrome,state,tabs}=mockChrome();
  tabs.set(19,{id:19,url:"https://www.youtube.com/watch?v=AbCdEf12345"});
  state.directImportStatus={state:"scanning",count:2,startedAt:Date.now(),tabId:19,token:"left-page"};
  await handle({type:"DIRECT_IMPORT_START"});
  expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
  expect(state.directImportStatus?.tabId).not.toBe(19);
 });
 it("serializes repeated import clicks into one active session",async()=>{
  const {chrome}=mockChrome();
  const attempts=await Promise.allSettled([
   handle({type:"DIRECT_IMPORT_START"}),handle({type:"DIRECT_IMPORT_START"})
  ]);
  expect(attempts.filter(x=>x.status==="fulfilled")).toHaveLength(1);
  expect(attempts.filter(x=>x.status==="rejected")).toHaveLength(1);
  expect(chrome.tabs.create).toHaveBeenCalledTimes(1);
 });
});
