# TubeShelf – Gerçek YouTube Kullanıcı Kabul Kontrol Listesi

Sürüm: 0.9.0. Başlamadan önce **Tam yedek indir** ile bir kopya al. Testleri gerçek abonelik verinle yapacağın için grupları silmek yerine geçici `UAT` grubu kullan.

| Kimlik | Senaryo | Beklenen davranış |
|---|---|---|
| UAT-01 | Chrome eklentisini güncelle, yeniden yükle | Benim Merkezim görünür, mevcut gruplar kaybolmaz |
| UAT-02 | YouTube'dan kanalları getir | Kanal sayısı artar, yükleme ilerlemesi görünür, eski gruplar korunur |
| UAT-03 | Tarama sürerken YouTube sekmesini kapat | İşlem hata ile sonlanır ve yeniden denenebilir |
| UAT-04 | 200–500 aboneyle Akıllı Akış'ı art arda aç | En fazla 12 kanal/tur yenilenir; çift istekler birleşir; ekran donmaz |
| UAT-05 | İki farklı grubun akışını aç | Yalnızca o grupların kanalları yer alır |
| UAT-06 | Shorts / canlı / izlenen filtrelerini ayrı ayrı dene | Bilinmeyen içerik türü uydurulmaz |
| UAT-07 | Videoyu kuyruğa ekle, sırala, kapatıp aç | Sıralama korunur |
| UAT-08 | YouTube sayfasında izlemeyi durdur, sonra aç | Kaydedilmiş konum uygulanır; reklam ilerlemesi video sayılmaz |
| UAT-09 | Tam yedek al, değişiklik yap, geri yükle | Önizleme ve onay çalışır, kişisel veriler geri gelir |
| UAT-10 | Chrome'u tamamen kapatıp aç | Gruplar, filtreler, kuyruk ve izlenme durumu korunur |
| UAT-11 | Bildirimleri seçili bir grupta aç | Tarayıcı izin ister; ilk etkinleştirmede eski videolar için bildirim yağmaz |
| UAT-12 | Ağı kısa süre kes, sonra yenile | Önceden alınan video kartları silinmez, kontrollü hata gösterilir |

**Durum ayrımı:** GitHub Actions'taki başsız Chromium kabul testi, oturum gerektirmeyen işlevleri otomatik doğrular. Yukarıdaki gerçek YouTube ve izin senaryoları tamamlanmadan canlı hesap UAT'si PASS olarak işaretlenemez.

UAT sonucu bildirirken Chrome sürümünü, açık abone sayısını, test kimliğini, beklenen ve gerçekleşen davranışı, varsa ekran görüntüsünü kaydet.
