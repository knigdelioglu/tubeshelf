# TubeShelf

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
