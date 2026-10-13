import type { Catalog, Group, Membership } from "./types";
export const now=()=>new Date().toISOString();
export function emptyCatalog():Catalog {return {schemaVersion:1,revision:0,updatedAt:now(),channels:[],groups:[],memberships:[]};}
export function changed(c:Catalog,patch:Partial<Catalog>):Catalog {return {...c,...patch,revision:c.revision+1,updatedAt:now()};}
function nameFor(c:Catalog,name:string,parentId:string|null,except?:string):string {
 const clean=name.trim();
 if(!clean || clean.length>80)throw new Error("Grup adı 1–80 karakter olmalı.");
 if(c.groups.some(g=>g.id!==except&&g.parentId===parentId&&g.name.toLocaleLowerCase("tr")===clean.toLocaleLowerCase("tr")))throw new Error("Bu konumda aynı adlı grup var.");
 return clean;
}
export function addGroup(c:Catalog,id:string,name:string,parentId:string|null):Catalog {
 if(c.groups.length>=2000)throw new Error("Grup sınırı aşıldı.");
 if(c.groups.some(g=>g.id===id))throw new Error("Grup kimliği tekrar ediyor.");
 if(parentId&&!c.groups.some(g=>g.id===parentId))throw new Error("Üst grup bulunamadı.");
 return changed(c,{groups:[...c.groups,{id,name:nameFor(c,name,parentId),parentId,createdAt:now()}]});
}
export function renameGroup(c:Catalog,id:string,name:string):Catalog {
 const g=c.groups.find(x=>x.id===id);
 if(!g)throw new Error("Grup bulunamadı.");
 const clean=nameFor(c,name,g.parentId,id);
 return changed(c,{groups:c.groups.map(x=>x.id===id?{...x,name:clean}:x)});
}
export function deleteGroup(c:Catalog,id:string):Catalog {
 const g=c.groups.find(x=>x.id===id);
 if(!g)throw new Error("Grup bulunamadı.");
 return changed(c,{groups:c.groups.filter(x=>x.id!==id).map(x=>x.parentId===id?{...x,parentId:g.parentId}:x),memberships:c.memberships.filter(m=>m.groupId!==id)});
}
export function descendants(groups:Group[],id:string):Set<string> {
 const result=new Set([id]);
 for(let i=0;i<groups.length;i++){let more=false;for(const g of groups)if(g.parentId&&result.has(g.parentId)&&!result.has(g.id)){result.add(g.id);more=true;}if(!more)break;}
 return result;
}
export function channelsInGroup(c:Catalog,id:string):Set<string> {
 const groups=descendants(c.groups,id);
 return new Set(c.memberships.filter(m=>groups.has(m.groupId)).map(m=>m.channelId));
}
