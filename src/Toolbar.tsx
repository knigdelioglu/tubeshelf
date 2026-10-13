import type {DirectImportStatus} from "./types";
interface Props {
 total:number;groups:number;query:string;showInactive:boolean;busy:boolean;
 notice:string;error:boolean;lastSync?:string;
 autoSync:boolean;autoConfigured:boolean;autoAuthorized:boolean;canEnableAuto:boolean;autoSyncError:string;
 setAutoSync:(value:boolean)=>void;
 directStatus?:DirectImportStatus;directImport:()=>void;
 search:(s:string)=>void;toggleInactive:(b:boolean)=>void;
 importCsv:(f:File)=>void;restore:(f:File)=>void;backup:()=>void;sync:()=>void;
}
export function Toolbar(p:Props){
 return <header className="toolbar">
  <span className="eyebrow">KİŞİSEL YOUTUBE KÜTÜPHANEN</span>
  <h1>Aboneliklerini düzenle</h1>
  <p>{p.total} kanal · {p.groups} grup · verilerin bu tarayıcıda</p>
  <div className="actions">
   <button className="primary" disabled={p.busy||["opening","scanning"].includes(p.directStatus?.state??"")}
     onClick={p.directImport}>↻ YouTube'dan kanalları getir</button>
   <label className="file-button">CSV içe aktar<input type="file" accept=".csv,text/csv" disabled={p.busy} onChange={e=>{const f=e.target.files?.[0];if(f)p.importCsv(f);e.target.value="";}}/></label>
   {p.autoConfigured&&<button disabled={p.busy} onClick={p.sync}>{p.busy?"İşleniyor…":"Google API ile eşitle"}</button>}
   <button disabled={p.busy} onClick={p.backup}>Yedek indir</button>
   <label className="file-button">Yedek yükle<input type="file" accept=".json,application/json" disabled={p.busy} onChange={e=>{const f=e.target.files?.[0];if(f)p.restore(f);e.target.value="";}}/></label>
  </div>
  {p.autoConfigured&&<div className="sync-settings">
   <label className="small-check">
    <input type="checkbox" checked={p.autoSync} disabled={!p.canEnableAuto}
     onChange={e=>p.setAutoSync(e.target.checked)}/>
    Otomatik eşitleme (12 saatte bir)
   </label>
   {!p.autoConfigured?<small>Önce Google OAuth istemci kimliğini yapılandırın.</small>:
    !p.autoAuthorized?<small>Önce ilk manuel YouTube eşitlemesini yapın.</small>:
    <small>Yalnızca mevcut Google izniyle arka planda çalışır.</small>}
  </div>}
  {p.autoSync&&p.autoSyncError&&<div className="notice error" role="alert">Son otomatik eşitleme hatası: {p.autoSyncError}</div>}
  {p.directStatus?.state==="opening"&&<div className="notice" role="status">YouTube abonelikler sayfası açılıyor…</div>}
  {p.directStatus?.state==="scanning"&&<div className="notice" role="status">YouTube kanalları okunuyor: {p.directStatus.count} kanal bulundu. İşlem bitene kadar açılan sekmeyi kapatmayın.</div>}
  {p.directStatus?.state==="done"&&<div className="notice" role="status">{p.directStatus.count} kanal YouTube'dan aktarıldı.</div>}
  {p.directStatus?.state==="error"&&<div className="notice error" role="alert">{p.directStatus.error??"YouTube abonelikleri okunamadı."}</div>}
  {p.lastSync&&<p className="sync-info">Son eşitleme: {new Date(p.lastSync).toLocaleString("tr-TR")}</p>}
  <div className="filter-bar">
   <label className="search">⌕ <input aria-label="Kanal ara" placeholder="Kanal ara…" value={p.query} onChange={e=>p.search(e.target.value)}/></label>
   <label className="small-check"><input type="checkbox" checked={p.showInactive} onChange={e=>p.toggleInactive(e.target.checked)}/> Abonelikten çıkılanları göster</label>
  </div>
  {p.notice&&<div className={"notice "+(p.error?"error":"")} role={p.error?"alert":"status"}>{p.notice}</div>}
 </header>;
}
