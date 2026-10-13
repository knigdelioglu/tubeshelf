/** Chrome MV3 acceptance smoke: built extension, UI, backup and browser restart.
 * Uses Node 22's built-in WebSocket and Chromium DevTools Protocol. */
import assert from "node:assert/strict";
import {spawn,spawnSync} from "node:child_process";
import {mkdtemp,mkdir,readFile,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join,resolve} from "node:path";

const sleep=ms=>new Promise(done=>setTimeout(done,ms));
async function until(fn,name,ms=30000){
 const start=Date.now();let last;
 while(Date.now()-start<ms){
  try{const value=await fn();if(value)return value;}catch(e){last=e;}
  await sleep(250);
 }
 throw new Error("Timeout: "+name+"; "+String(last??"not ready"));
}
function chromeBinary(){
 if(process.env.CHROME_BIN)return process.env.CHROME_BIN;
 for(const bin of ["google-chrome","google-chrome-stable","chromium","chromium-browser"]){
  const result=spawnSync("which",[bin],{encoding:"utf8"});
  if(result.status===0)return result.stdout.trim();
 }
 throw new Error("Chrome/Chromium unavailable");
}
class CDP {
 constructor(socket){
  this.socket=socket;this.seq=0;this.pending=new Map();
  socket.addEventListener("message",event=>{
   const response=JSON.parse(String(event.data));
   const item=this.pending.get(response.id);if(!item)return;
   this.pending.delete(response.id);
   if(response.error)item.reject(new Error(item.method+": "+response.error.message));
   else item.resolve(response.result??{});
  });
  socket.addEventListener("close",()=>{
   for(const item of this.pending.values())item.reject(new Error("Chrome disconnected"));
   this.pending.clear();
  });
 }
 send(method,params={},sessionId){
  const id=++this.seq;
  return new Promise((resolve,reject)=>{
   this.pending.set(id,{method,resolve,reject});
   this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));
  });
 }
 async evaluate(sessionId,body){
  const response=await this.send("Runtime.evaluate",{
   expression:"(async()=>{"+body+"})()",awaitPromise:true,returnByValue:true
  },sessionId);
  if(response.exceptionDetails)throw new Error("Browser JS: "+response.exceptionDetails.text+
   " "+(response.exceptionDetails.exception?.description??""));
  return response.result?.value;
 }
 close(){this.socket.close();}
}
const chromeBin=chromeBinary(),dist=resolve(process.env.EXTENSION_DIR??"dist");
const profile=await mkdtemp(join(tmpdir(),"tubeshelf-browser-uat-"));
const reports=resolve(process.env.UAT_REPORT_DIR??"artifacts");
await mkdir(reports,{recursive:true});
let child,cdp,session;
async function stop(){
 try{cdp?.close();}catch{}
 cdp=undefined;session=undefined;
 if(!child)return;
 const old=child;child=undefined;
 old.kill("SIGTERM");
 await Promise.race([new Promise(done=>old.once("exit",done)),sleep(4000)]);
 if(old.exitCode===null)old.kill("SIGKILL");
}
async function start(){
 await rm(join(profile,"DevToolsActivePort"),{force:true});
 child=spawn(chromeBin,["--headless=new","--no-sandbox","--disable-dev-shm-usage",
  "--no-first-run","--no-default-browser-check","--disable-background-networking",
  "--remote-debugging-port=0","--enable-extensions",
  "--user-data-dir="+profile,"--disable-extensions-except="+dist,
  "--load-extension="+dist,"about:blank"],{stdio:["ignore","ignore","pipe"]});
 let chromeErrors="";
 child.stderr.on("data",b=>{chromeErrors+=String(b).slice(0,2000);});
 const port=await until(async()=>{
  try{return (await readFile(join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0];}
  catch{return null;}
 },"Chrome debug port "+chromeErrors);
 const version=await until(async()=>{
  const res=await fetch("http://127.0.0.1:"+port+"/json/version");
  return res.ok?res.json():null;
 },"DevTools JSON");
 const socket=new WebSocket(version.webSocketDebuggerUrl);
 await new Promise((resolve,reject)=>{
  socket.addEventListener("open",resolve,{once:true});
  socket.addEventListener("error",reject,{once:true});
 });
 cdp=new CDP(socket);
 const seenWorkers=new Set();
 const extension=await until(async()=>{
  const targets=await cdp.send("Target.getTargets");
  const workers=targets.targetInfos?.filter(t=>t.url?.startsWith("chrome-extension://")&&t.url.includes("background.js"))??[];
  for(const worker of workers){
   const id=worker.url.split("/")[2];
   if(!/^[a-z]{32}$/.test(id??""))continue;
   try{
    const attached=await cdp.send("Target.attachToTarget",{targetId:worker.targetId,flatten:true});
    const workerSession=attached.sessionId;
    await cdp.send("Runtime.enable",{},workerSession);
    const result=await cdp.send("Runtime.evaluate",{
     expression:"chrome.runtime.getManifest().name",returnByValue:true
    },workerSession);
    const name=String(result.result?.value??"");
    if(name.includes("TubeShelf"))return {id,workerSession};
    if(!seenWorkers.has(id)){console.log("Ignoring unrelated extension worker:",id,name);seenWorkers.add(id);}
   }catch(err){
    if(!seenWorkers.has(id)){console.log("Worker inspection failed:",id,String(err));seenWorkers.add(id);}
   }
  }
  return null;
 },"TubeShelf MV3 background worker");
 const workerSession=extension.workerSession;
 const opened=await cdp.send("Runtime.evaluate",{
  expression:"chrome.tabs.create({url:chrome.runtime.getURL('index.html')}).then(t=>t.id)",
  awaitPromise:true,returnByValue:true
 },workerSession);
 if(opened.exceptionDetails)throw new Error("Extension cannot open dashboard: "+opened.exceptionDetails.text);
 const page=await until(async()=>{
  const targets=await cdp.send("Target.getTargets");
  return targets.targetInfos?.find(t=>t.type==="page"&&
   t.url?.startsWith("chrome-extension://"+extension.id+"/index.html"));
 },"extension-created TubeShelf dashboard");
 const target=await cdp.send("Target.attachToTarget",{targetId:page.targetId,flatten:true});
 session=target.sessionId;
 await cdp.send("Runtime.enable",{},session);
 await cdp.send("Page.enable",{},session);
 try{
  await until(()=>evaluate('return !!document.querySelector(".center-workspace");'),"TubeShelf rendered home");
 }catch(err){
  let pageInfo;
  try{pageInfo=await evaluate('return ({url:location.href,readyState:document.readyState,title:document.title,body:document.body?.innerText?.slice(0,1400),html:document.documentElement.outerHTML.slice(0,500),chrome:!!globalThis.chrome?.runtime?.id});');}
  catch(e){pageInfo={error:String(e)};}
  console.error("INITIAL PAGE DIAGNOSTICS:",JSON.stringify(pageInfo));
  const targets=await cdp.send("Target.getTargets").catch(()=>({targetInfos:[]}));
  console.error("CHROME TARGETS:",JSON.stringify(targets.targetInfos?.map(t=>({type:t.type,url:t.url,attached:t.attached}))));
  throw err;
 }
 return extension.id;
}
async function evaluate(body){return cdp.evaluate(session,body);}
async function api(message){
 const response=await evaluate("return await chrome.runtime.sendMessage("+JSON.stringify(message)+");");
 assert.equal(response?.ok,true, message.type+": "+response?.error);
 return response;
}
async function screenshot(){
 try{
  if(!cdp||!session)return;
  const shot=await cdp.send("Page.captureScreenshot",{format:"png"},session);
  await writeFile(join(reports,"browser-uat-failure.png"),Buffer.from(shot.data,"base64"));
 }catch{}
}
try{
 console.log("Chrome binary:",chromeBin);
 const extensionId=await start();
 console.log("PASS: Installed and rendered MV3 extension",extensionId);
 await evaluate('document.querySelector("#new-group").focus();return true;');
 await cdp.send("Input.insertText",{text:"UAT Test Group"},session);
 await until(()=>evaluate('return document.querySelector("#new-group")?.value==="UAT Test Group";'),"group name input");
 await evaluate('document.querySelector(".create-form button[type=submit]").click();return true;');
 await until(()=>evaluate('return [...document.querySelectorAll(".group-button")].some(x=>x.textContent.includes("UAT Test Group"));'),"group creation");
 const catalog=(await api({type:"CATALOG_GET"})).catalog;
 const group=catalog.groups.find(g=>g.name==="UAT Test Group");
 assert.ok(group,"UI click must create a real catalog group");
 console.log("PASS: Group creation via keyboard input and UI click");

 // Test a stale import left by a closed YouTube tab, without a logged-in account.
 await evaluate('await chrome.storage.local.set({directImportStatus:{state:"scanning",count:7,startedAt:Date.now(),tabId:999999,token:"abandoned"}});return true;');
 await api({type:"DIRECT_IMPORT_START"});
 const importStatus=await evaluate('return (await chrome.storage.local.get("directImportStatus")).directImportStatus;');
 assert.equal(importStatus.state,"opening");
 assert.notEqual(importStatus.tabId,999999);
 await evaluate('await chrome.tabs.remove('+importStatus.tabId+');return true;');
 await until(()=>evaluate('return (await chrome.storage.local.get("directImportStatus")).directImportStatus?.state==="error";'),
  "closed import tab reports actionable error",10000);
 console.log("PASS: Abandoned YouTube import can restart, closed tab reports error");

 const channelId="UC"+"x".repeat(22),videoId="AbCdEf12345";
 await api({type:"CATALOG_IMPORT",channels:[{id:channelId,title:"UAT Channel"}]});
 await api({type:"MEMBERSHIP_SET",groupId:group.id,channelIds:[channelId],enabled:true});
 const video={id:videoId,channelId,channelTitle:"UAT Channel",title:"UAT Video",
  publishedAt:"2026-10-13T12:00:00Z",kind:"video",
  url:"https://www.youtube.com/watch?v="+videoId,
  thumbnail:"https://i.ytimg.com/vi/"+videoId+"/hqdefault.jpg"};
 await api({type:"WATCH_QUEUE_ADD",video});
 await api({type:"WATCH_PROGRESS_SET",videoId,position:57,duration:600});
 await api({type:"SMART_READ_SET",videoId,read:true});
 await api({type:"SMART_MUTE_SET",channelId,muted:true});
 await evaluate('document.querySelectorAll(".view-switcher button").forEach(x=>{if(x.textContent.includes("İzleme kuyruğu"))x.click();});return true;');
 await until(()=>evaluate('return !!document.querySelector(".queue-row");'),"queue rendered");
 console.log("PASS: Queue, watch position, read and mute operations");
 const backup=(await api({type:"FULL_BACKUP_CREATE"})).backup;
 assert.equal(backup.queue.length,1);
 assert.equal(backup.progress[0]?.position,57);
 assert.ok(backup.readVideoIds.includes(videoId));
 assert.ok(backup.mutedChannelIds.includes(channelId));
 assert.equal((await api({type:"FULL_BACKUP_PREVIEW",backup})).preview.format,"full");
 await api({type:"WATCH_QUEUE_CLEAR"});
 assert.equal((await api({type:"WATCH_GET"})).state.queue.length,0);
 await api({type:"FULL_BACKUP_RESTORE",backup});
 assert.equal((await api({type:"WATCH_GET"})).state.queue.length,1);
 console.log("PASS: Backup validation, clear and restore");
 await stop();
 const sameId=await start();
 assert.equal(sameId,extensionId,"Extension ID changed across restart");
 assert.equal((await api({type:"WATCH_GET"})).state.queue.length,1);
 assert.ok((await api({type:"CATALOG_GET"})).catalog.groups.some(g=>g.id===group.id));
 const restored=(await api({type:"FULL_BACKUP_CREATE"})).backup;
 assert.ok(restored.readVideoIds.includes(videoId));
 assert.ok(restored.progress.some(p=>p.videoId===videoId&&p.position===57));
 console.log("PASS: Real Chrome restart preserves catalog, queue, reading and position");
 console.log("Chrome UAT: ALL PASS");
}catch(error){
 console.error("Chrome UAT FAILED",error?.stack??String(error));
 await screenshot();
 process.exitCode=1;
}finally{
 await stop();
 if(!process.env.UAT_KEEP_PROFILE)await rm(profile,{recursive:true,force:true});
}
