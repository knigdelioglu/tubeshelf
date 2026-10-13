import {build} from "esbuild";
import {writeFile} from "node:fs/promises";
for(const name of ["background","content"]){
 await build({entryPoints:["src/"+name+".ts"],outfile:"dist/"+name+".js",bundle:true,format:"iife",platform:"browser",target:"chrome120"});
}
const oauthId=process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
const manifest={
 manifest_version:3,name:"TubeShelf – YouTube Subscription Manager",short_name:"TubeShelf",version:"0.9.1",
 description:"YouTube aboneliklerini gruplara ayır; yerel olarak sakla.",
 permissions:["storage","identity","alarms"],
 optional_permissions:["notifications"],
 host_permissions:["https://www.youtube.com/*","https://www.googleapis.com/*"],
 content_security_policy:{extension_pages:"script-src 'self'; object-src 'self'; frame-src https://www.youtube-nocookie.com https://www.youtube.com"},
 action:{default_title:"TubeShelf panelini aç"},
 background:{service_worker:"background.js"},
 content_scripts:[{matches:["https://www.youtube.com/*"],js:["content.js"],run_at:"document_idle"}]
};
if(oauthId){
 if(!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(oauthId))throw new Error("Invalid Google OAuth Client ID.");
 manifest.oauth2={client_id:oauthId,scopes:["https://www.googleapis.com/auth/youtube.readonly"]};
}
await writeFile("dist/manifest.json",JSON.stringify(manifest,null,2)+"\n");
console.log("dist/ klasörünü chrome://extensions üzerinden yükleyebilirsiniz.");
