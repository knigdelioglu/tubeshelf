import type {Request,Response} from "./types";
import {handle} from "./service";
chrome.action.onClicked.addListener(()=>{
 void chrome.tabs.create({url:chrome.runtime.getURL("index.html")});
});
chrome.runtime.onMessage.addListener((raw:unknown,_sender,sendResponse:(response:Response)=>void)=>{
 if(!raw||typeof raw!=="object"||!("type" in raw)||typeof raw.type!=="string"||raw.type==="CATALOG_CHANGED")return false;
 handle(raw as Request)
  .then(catalog=>sendResponse({ok:true,catalog}))
  .catch((error:unknown)=>sendResponse({ok:false,error:error instanceof Error?error.message:"Bilinmeyen hata."}));
 return true;
});
