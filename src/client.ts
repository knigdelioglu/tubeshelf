import type {Catalog,Request,Response} from "./types";
export async function send(request:Request):Promise<Catalog> {
 if(typeof chrome==="undefined"||!chrome.runtime?.id)throw new Error("TubeShelf panelini Chrome eklentisinden açın.");
 const response=await chrome.runtime.sendMessage(request) as Response;
 if(!response?.ok)throw new Error(response?.error??"İstek başarısız oldu.");
 return response.catalog;
}
