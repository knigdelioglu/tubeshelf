# TubeShelf

**v0.6.0 — Kişisel YouTube Merkezi: özelleştirilebilir pano, grup önerileri, kanal etkinliği ve isteğe bağlı grup bildirimleri**

**Kişisel YouTube abonelik yöneticisi · Chrome Manifest V3 · TypeScript/React**

TubeShelf, abonelikleri yerel gruplara ayırır. Kanallarınızı YouTube üzerinde değiştirmez; düzeninizi tarayıcı uzantısına ait IndexedDB'de saklar.

## Kurulum

Node.js 22+ gerekir.

```bash
npm ci
npm run verify
```

1. Chrome'da `chrome://extensions` sayfasını açın.
2. **Geliştirici modu**nu etkinleştirin.
3. **Paketlenmemiş öğe yükle** ile oluşan **dist/** klasörünü seçin.
4. TubeShelf araç çubuğu simgesine tıklayıp yönetim panelini açın.
5. YouTube sayfasını yenileyince sol menüde TubeShelf grupları görünür.

Alternatif: GitHub Actions başarılı olduğunda `tubeshelf-chrome-unpacked` çıktısını indirip bir klasöre açın; bu klasörü yükleyin.

## Önerilen yöntem: YouTube'dan doğrudan aktarım

1. Chrome'da YouTube hesabınızda oturum açın.
2. TubeShelf panelindeki **YouTube'dan kanalları getir** düğmesine tıklayın.
3. Eklenti `youtube.com/feed/channels` sayfasını yeni bir sekmede açar, görünen kanalları ve sayfanın devamını tarayıp yerel kataloğa kaydeder. Tarama bitene kadar sekmeyi kapatmayın.
4. Panelde ilerleme ve sonuç görüntülenir. Var olan gruplar korunur; aktarım YouTube aboneliklerinizi değiştirmez.

Bu yöntem Google Takeout, Google Cloud, OAuth anahtarı ya da ayrı hesap bağlantısı gerektirmez. YouTube sayfa yapısına bağlıdır ve arayüz değişirse güncellenmesi gerekir. Eksiksiz liste sonu doğrulanamazsa **kısmi abonelik listesi otomatik kaydedilmez**. Kanal kimliğinin okunamadığı durumlarda görünen kanal `@handle` adresi geçici kimlik olarak kullanılır; handle değişirse ayrı kayıt oluşabilir.

## Alternatif: CSV veya resmî API



**CSV yedeği:** Google Takeout'tan YouTube aboneliklerinin `subscriptions.csv` dosyasını dışa aktarın. Panelde **CSV içe aktar** düğmesini kullanın. Kanal kimliği ve başlığı olan satırlar alınır; mükerrer kayıtlar atlanır.

**İsteğe bağlı OAuth/API senkronizasyonu:**

1. İlk kez paketlenmemiş eklentiyi yükleyip `chrome://extensions` sayfasından **eklenti kimliğini** alın.
2. Google Cloud Console'da YouTube Data API v3'ü etkinleştirin; OAuth izin ekranında `youtube.readonly` kapsamını yapılandırın ve gerekiyorsa kendinizi test kullanıcısı ekleyin.
3. **Chrome Extension** türünde OAuth istemcisi oluşturun ve eklenti kimliğini girin.
4. Terminalde `YOUTUBE_OAUTH_CLIENT_ID=CLIENT_ID npm run build` komutunu çalıştırın, uzantıyı yeniden yükleyin.
5. **YouTube senkronize et** ile Google hesabınızdan okuma izni verin.

İlk manuel eşitleme başarılı olduktan sonra panelde **Otomatik eşitleme (12 saatte bir)** seçeneği açılabilir. Bu isteğe bağlıdır, tarayıcı açıkken Chrome alarms üzerinden çalışır ve arka planda yeni izin penceresi açmaz. Yetki süresi dolarsa panelde hata görüntülenir; yeniden manuel eşitleme yapın.

Kimlik yapılandırılmadıysa eşitleme açık bir hata verir; CSV/grup yönetimi çalışmaya devam eder. Kimlik, giriş parolası veya erişim belirteci depoya eklenmez. Google'ın test modu ve yetkilendirme kısıtları geçerli olabilir.

## Yapabilecekleriniz

- Grup ve alt grup oluşturma (yerel güvenlik sınırı: 2000). Grupları sürükleyerek yeniden konumlandırma.
- Tek kanalı birden çok gruba bağlama; toplu seçim ve gruba sürükle-bırak.
- YouTube sol menüsünden gruplara hızlı erişim.
- Yerel JSON yedeği ve doğrulamalı geri yükleme.
- Abonelik senkronizasyonunda düzeni koruma: abonelikten çıkılan kanallar kayıtta kalır, varsayılan listede gizlenir.

**Önemli:** Eklentiyi kaldırmak yerel veritabanını silebilir; düzenli olarak JSON yedeği indirin. Google Takeout içe aktarması tek seferliktir; otomatik eşitleme için yukarıdaki OAuth kurulumu gerekir.

## Geliştirme

- `npm run check`: TypeScript denetimi
- `npm test`: Vitest
- `npm run build`: yönetim paneli (Vite), bağımsız content script ve service worker (esbuild), Manifest V3
- `npm run dev`: yalnızca arayüz geliştirme sunucusu; tarayıcı eklentisi API'leri bu sunucuda çalışmaz.

**Kapsam:** Bu ilk aşama abonelik/grup yönetimidir. Grup bazlı güncel video akışı, Shorts filtreleri ve çok sütunlu pano sonraki aşamalardadır.

## Gizlilik

Veriler IndexedDB içinde, uzantı kökeninde saklanır. Otomatik senkronizasyon seçilirse YouTube Data API yalnızca abone olunan kanalları okumak için çağrılır. Sunucu, analiz hizmeti veya telemetri yoktur.

## Denetim notları

- Aynı veritabanını kullanan açık paneller güncelleme mesajı ile yenilenir.
- Grup taşıma işlemi kendi altına taşıma ve kardeş isim çakışmalarını engeller.
- Abonelik sayfaları bitmeden kayıt değiştirilmez; bozuk ve yinelenen API sayfa belirteçleri işlemeyi durdurur.
- Otomatik senkronizasyon kullanıcı izni olmadan etkin değildir, Chrome kapalıyken garantili bir zamanlayıcı değildir.
- Gerçek Google OAuth ve canlı YouTube navigasyonu için tarayıcı kabul testi ayrıca gerekir.

**Doğrudan aktarım ve API farkı:** Doğrudan aktarım YouTube'un oturum açılmış sayfasından kullanıcı arayüzü verilerini okur. API senkronizasyonu kimlik doğrulamalı resmî yöntemi kullanır ve otomatik zamanlama yalnızca onunla çalışır. Her iki yol birbirinin zorunlu önkoşulu değildir.

## Video akışları (0.3.0)

- Sol menüden **Tüm yeni videolar**, **Video panosu** veya bir **grup** seçin.
- **Yeni videoları getir**: Sunucusuz, yerel önbellekli YouTube Atom yayınlarıyla kanalların son videolarını toplar. OAuth veya Google Cloud gerekmez.
- Bir gruptan seçilen videolar oynatıcıda veya **YouTube'da aç** bağlantısından izlenebilir. Pano her grup için altı yeni video gösterir.
- **Shorts gizle**, **Canlı yayınları gizle**, **İzlediklerimi gizle**, tarih ve metin araması uygulanır.
- **İzledim** düğmesi yerel olarak kaydeder. YouTube sitesinde normal video oynatıcısında belirli bir ilerlemeye ulaşan videolar da otomatik işaretlenir. YouTube hesap izleme geçmişinin tamamını okuma iddiası yoktur. Gömülü oynatıcıda otomatik işaretleme yapılmaz; **İzledim** düğmesini kullanın.

### Kaynaklar ve dürüst sınırlamalar

Kanalın `UC...` kimliğinden türetilmiş `UULF` (normal), `UUSH` (Shorts) ve `UULV` (canlı yayın) Atom yayınları kullanılır. **Bunlar YouTube'un belgelenmiş, kararlı bir API'si değildir.** Erişilemeyen türler genel kanal yayınıyla tamamlanır ve türü doğrulanamayan içerikler **Türü belirsiz** olarak gösterilir; Shorts ve canlı filtreleri belirsiz içerikleri yanlışlıkla gizlemez. Bu yüzden filtrelerin %100 kusursuz olması garanti edilemez. UULV içeriği canlı yayın kayıtlarını da içerebilir, yalnızca o anda canlı olan yayınlar değildir.

Yayınlar sınırlı sayıda güncel video sağlar; bütün YouTube arşivi veya hesap öneri akışı değildir. Önbellek 30 dakika boyunca yeniden indirilmez. Otomatik açılış taramasında en çok 50 henüz taze olmayan kanal taranır; çok fazla aboneniz varsa **Yeni videoları getir** düğmesine yeniden basarak en eski kontrol edilmiş diğer kanalları tarayabilirsiniz. Bu düğme önbellek süresi dolmasa bile yeniler. Hatalı ağ yanıtları var olan geçerli video kayıtlarını silmez.

YouTube arayüzünde sağlanan bağlantılar gruba özel TubeShelf video akışını açar. Videonun YouTube'da yeni sekmede açılması halinde YouTube kendi öneri akışını gösterebilir; TubeShelf bu akışı değiştirmez.

## Akıllı Akış (v0.4.0)

- **Gelen kutusu:** İlk kullanımda oluşturulan yerel başlangıç zamanından **sonra yayımlanmış** ve okunmamış/izlenmemiş son videoları gösterir. Önceki abonelik arşivi topluca `yeni` olarak sayılmaz. Sayaçlar YouTube'un resmî bildirim sayısı değil, **TubeShelf'ün yerel önbelleğindeki erişilebilen yeni videoların sayısıdır**.
- **Sayaçlar:** Gelen kutusu ve her grupta (alt grupları kapsayarak, yinelenen videoları tek sayarak) gösterilir. Okundu veya izlendi işaretlemek sayacı günceller. **Bu akıştaki yenileri okundu işaretle** bütün eldeki görünür yeni videoları topluca işaretler.
- **Filtreler:** Kanal, arama, tarih (24 saat/7/30 gün), içerik türü, okunma, izleme, sıralama. Filtreler **görünüm/grup bazında** otomatik kaydedilir, yeniden açınca geri gelir; tek tıkla sıfırlanabilir. Video süreleri Atom yayınında güvenilir gelmediğinden süre filtresi eklenmedi.
- **Sessiz kanal:** Akış kartından veya **Sessize alınan kanallar** bölümünden bir kanalı sessize alabilir ve yeniden açabilirsin. YouTube aboneliği, kanal ve grup üyeliği silinmez.
- **Yenileme:** İstekler küçük partilere (12 kanal/tur, en fazla 3 eş zamanlı kanal) ayrıldı. Kanal başına tekrar denemeler hatadan sonra artan beklemeye tabi. Başarısız tarama mevcut video kayıtlarını silmez. **Yeni videoları getir** önbelleği zorlayabilir, ancak geçici hata beklemesini aşmaz.
- **İsteğe bağlı saatlik kontrol:** Tarayıcı açıkken Chrome alarm sistemiyle otomatik bir parti yenilenir. Devamlı çalışan haricî sunucu yoktur. Sessize alınan kanallar ağ taramasından çıkarılır.

**Teknik sınırlar:** Resmî olmayan YouTube kategori Atom yayınları ve genel Atom feed'i her zaman erişilebilir değildir; YouTube değişikliklerinde video kapsamı ve türü eksik kalabilir. İlk kullanım zaman damgasından önce yayımlanmış videolar gelen kutusunda yeni sayılmaz. Kalıcı izleme/okunma/sessiz kanal verileri tarayıcıdaki IndexedDB'dedir; mevcut JSON grup yedeği bu yeni ayarları kapsamaz. Bunların kapsamlı yedeklenmesi sonraki geliştirme konusu.

## İzleme deneyimi (v0.5.0)

- **Kuyruğa ekle:** Gelen kutusunda ve video akışında videonun kartından kuyruğa ekleyin. Aynı video iki kez eklenmez.
- **Kuyruk:** Soldaki **İzleme kuyruğu** sayfasından 300 videoya kadar saklayın; sürükle-bırak veya ↑/↓ düğmeleriyle sıralayın. Videolar grubundan kaldırılsa bile kuyruk öğesi kalır.
- **İzlemeye devam et:** YouTube'da normal videoları izlerken HTML5 ana oynatıcının süresi ve konumu yerel IndexedDB'ye kaydedilir (yaklaşık her 12 saniye, duraklatma/bitişte ayrıca). Kuyruktaki **YouTube'da kaldığın yerden aç** düğmesi kayıtlı saniyeyi adres parametresine ekler.
- **Tamamlandı:** Yerel ilerleme %90'a veya video sonuna yaklaştığında tamamlanmış olarak saklanır; bu, YouTube hesap izleme geçmişinin tamamını kapsamaz. Elle tamamlandı seçeneği gerçek süre bilinmese de tamamlama işareti koyar.
- **Klavye:** Kuyruk sayfasında J/K önceki/sonraki öğeyi seçer, Enter yerel oynatıcı açar, M tamamlandı işaretler, F odak moduna girer/çıkar, Esc oynatıcıyı kapatır. Form alanlarında kısayollar devre dışıdır.
- **Odak modu:** Kuyruk sayfasında TubeShelf kenar menüsü ve çoklu liste görünümünü kapatarak yalnızca sıradaki öğeye odaklanır; F ile geri dönülür.
- **Gömülü oynatıcı sınırı:** YouTube'un iframe oynatıcısının gerçek ilerleme verisi eklentiye otomatik gelmez. Bu nedenle gömülü oynatıcıda ilerleme kaydı varmış gibi davranılmaz; kullanıcı tamamlandı işareti koyabilir veya YouTube'da açıp ilerlemeyi kaydedebilir. Bazı videolar iframe içinde oynatılamayabilir.
- **Veri koruma:** Veritabanı şeması v3→v4 yükselir ve mevcut grup, video önbelleği, izlenme/okunma, sessiz kanal bilgilerini silmez. Kuyruk/ilerleme yereldir; mevcut yalnızca grup verisi içeren JSON yedeğine henüz eklenmemiştir.

## Kişisel YouTube Merkezi (v0.6.0)

TubeShelf artık **Benim Merkezim** sayfasıyla açılır. Eski Video panosu, Akıllı Akış, Kanal yönetimi ve İzleme kuyruğu aynen korunur.

- **Özelleştirilebilir ana pano:** Grupları yıldızla sabitleyip yukarı/aşağı taşı, 1–3 sütun ve grup başına 3/6/9 video seç, sabitlenmemiş grupları isteğe bağlı gizle. Tercihler `chrome.storage.local` içinde bu tarayıcıda tutulur.
- **Açıklanabilir grup önerileri:** Kanal adlarını ve daha önce okunmuş son video başlıklarını mevcut grup adları ve konu terimleriyle eşleştirir. Önerilerin hiçbiri otomatik uygulanmaz; **Gruba ekle** düğmesine tıklaman gerekir. Yapay zekâ modeline veri gönderilmez.
- **Kanal etkinlik analizi:** 30 gün içinde görülen yayınlar, eldeki en son video tarihi, taraması başarısız veya hiç yapılmamış kanallar. Bu istatistikler bütün YouTube geçmişini değil, erişilebilir Atom yayın önbelleğini temsil eder; “90+ gün” etiketi kesin hareketsizlik iddiası değildir.
- **Seçili grup bildirimleri:** Önce grupları işaretle, ardından **Bildirimleri etkinleştir** düğmesine bas. Chrome, isteğe bağlı bildirim izni sorar. Eklenti tarayıcı açıkken saatte bir video kontrolü yapar, yalnızca ilk etkinleştirmeden sonra keşfedilen ve yerel olarak yeni sayılan yayınları grup başına en fazla bir özet bildirimde birleştirir. Önceden görülmüş video kimlikleri tekrar bildirilmez. Bildirime tıklamak grup video akışını açar.
- Bildirim izni verilmezse veya grup seçilmezse özellik etkinleşmez; varsayılanı kapalıdır. Tarayıcı kapalıyken arka plan çalışması garanti edilmez. Bildirim zamanı ve kapsamı yerel cache ile ağ erişimine bağlıdır.
- **Yerel veri korunur:** IndexedDB şeması v4 olarak kalır; grup, kuyruk, okunma ve izleme verileri değiştirilmez. Pano/bildirim tercihleri mevcut JSON grup yedeğine henüz dahil değildir.

### Doğrulama

`npm ci && npm run verify` komutu TypeScript denetimi, Vitest testleri ve Manifest V3 üretim derlemesini çalıştırır. Yeni arayüzde gerçek Chrome/YouTube UAT testi ayrı gerekir.
