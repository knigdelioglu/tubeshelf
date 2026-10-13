import type {SmartVideo} from "./smart-types";
import type {VideoKind} from "./video-types";
import {formatVideoDate} from "./feed-domain";
const kinds:Record<VideoKind,string>={video:"Video",short:"Shorts",live:"Canlı/kayıt",unknown:"Türü belirsiz"};
interface Props {
 video:SmartVideo;onPlay:(video:SmartVideo)=>void;
 queued:boolean;onQueue:(video:SmartVideo)=>void;
 onRead:(id:string,read:boolean)=>void;
 onWatched:(id:string,watched:boolean)=>void;
 onMute:(id:string)=>void;
}
export function SmartVideoCard({video,onPlay,onRead,onWatched,onMute,onQueue,queued}:Props){
 return <article className={"video-card smart-video-card "+(video.watched?"video-watched":"")}>
  <button className="video-cover" onClick={()=>onPlay(video)} aria-label={video.title+" oynat"}>
   <img src={video.thumbnail} alt="" loading="lazy"/>
   {video.unread&&<span className="new-dot">YENİ</span>}
   <span className="video-play" aria-hidden="true">▶</span>
   <span className={"video-kind kind-"+video.kind}>{kinds[video.kind]}</span>
  </button>
  <div className="video-info">
   <h3 title={video.title}>{video.title}</h3>
   <p>{video.channelTitle} · {formatVideoDate(video.publishedAt)}</p>
   <div className="smart-card-actions">
    <button aria-pressed={video.read} onClick={()=>onRead(video.id,!video.read)}>
     {video.read?"✓ Okundu":"○ Okundu"}
    </button>
    <button aria-pressed={video.watched} onClick={()=>onWatched(video.id,!video.watched)}>
     {video.watched?"✓ İzlendi":"İzledim"}
    </button>
    <button disabled={queued} title={queued?"Kuyrukta":"İzleme kuyruğuna ekle"} onClick={()=>onQueue(video)}>
     {queued?"✓ Kuyrukta":"+ Kuyruğa ekle"}
    </button>
    <button title={video.channelTitle+" kanalını sessize al"} onClick={()=>onMute(video.channelId)}>
     <span aria-hidden="true">◌</span> Sessize al
    </button>
    <a href={video.url} target="_blank" rel="noopener noreferrer" onClick={()=>onRead(video.id,true)}>
     YouTube ↗
    </a>
   </div>
  </div>
 </article>;
}
