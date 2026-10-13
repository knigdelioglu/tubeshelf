interface Props {
 total:number;groups:number;query:string;showInactive:boolean;busy:boolean;
 notice:string;error:boolean;lastSync?:string;
 autoSync:boolean;autoConfigured:boolean;autoAuthorized:boolean;canEnableAuto:boolean;autoSyncError:string;
 setAutoSync:(value:boolean)=>void;
 search:(s:string)=>void;toggleInactive:(b:boolean)=>void;
 importCsv:(f:File)=>void;restore:(f:File)=>void;backup:()=>void;sync:()=>void;
}
export function Toolbar(p:Props){
 return <header className="toolbar">
  <span className="eyebrow">KİŞİSEL YOUTUBE KÜTÜPHANEN</span>
  <h1>Aboneliklerini düzenle</h1>
  <p>{p.total} kanal · {p.groups} grup · verilerin bu tarayıcıda</p>
  <div className="actions">
   <label className="file-button">CSV içe aktar<input type="file" accept=".csv,text/csv" disabled={p.busy} onChange={e=>{const f=e.target.files?.[0];if(f)p.importCsv(f);e.target.value="";}}/></label>
   <button className="primary" disabled={p.busy} onClick={p.sync}>{p.busy?"İşleniyor…":"↻ YouTube senkronize et"}</button>
   <button disabled={p.busy} onClick={p.backup}>Yedek indir</button>
   <label className="file-button">Yedek yükle<input type="file" accept=".json,application/json" disabled={p.busy} onChange={e=>{const f=e.target.files?.[0];if(f)p.restore(f);e.target.value="";}}/></label>
  </div>
  <div className="sync-settings">
   <label className="small-check">
    <input type="checkbox" checked={p.autoSync} disabled={!p.canEnableAuto}
     onChange={e=>p.setAutoSync(e.target.checked)}/>
    Otomatik eşitleme (12 saatte bir)
   </label>
   {!p.autoConfigured?<small>Önce Google OAuth istemci kimliğini yapılandırın.</small>:
    !p.autoAuthorized?<small>Önce ilk manuel YouTube eşitlemesini yapın.</small>:
    <small>Yalnızca mevcut Google izniyle arka planda çalışır.</small>}
  </div>
  {p.autoSync&&p.autoSyncError&&<div className="notice error" role="alert">Son otomatik eşitleme hatası: {p.autoSyncError}</div>}
  {p.lastSync&&<p className="sync-info">Son eşitleme: {new Date(p.lastSync).toLocaleString("tr-TR")}</p>}
  <div className="filter-bar">
   <label className="search">⌕ <input aria-label="Kanal ara" placeholder="Kanal ara…" value={p.query} onChange={e=>p.search(e.target.value)}/></label>
   <label className="small-check"><input type="checkbox" checked={p.showInactive} onChange={e=>p.toggleInactive(e.target.checked)}/> Abonelikten çıkılanları göster</label>
  </div>
  {p.notice&&<div className={"notice "+(p.error?"error":"")} role={p.error?"alert":"status"}>{p.notice}</div>}
 </header>;
}
