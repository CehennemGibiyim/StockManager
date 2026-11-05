# Sürüm notları

Tüm önemli değişiklikler bu dosyada tutulur. Kurulum paketleri GitHub Releases sayfasından indirilir.

## [1.1.0] - 2026-11-05

### Düzeltildi

- Veriler artık her açılışta aynı yerel adresten yükleniyor; kapatıp açınca kaybolma sorunu giderildi.
- "Yedek al" düğmesi masaüstünde yalnızca tarayıcı indirmesi tetikliyordu; artık kurulum klasöründeki `backups` dizinine yazıyor.
- Uygulama kapanırken yedek alınmıyordu; kapanış öncesi son kayıt diske yazılıyor.
- Güncelleme indirme adresi ana sürece aktarılmıyordu; uygulama içi güncelleme artık çalışıyor ve kurulum açıldıktan sonra uygulama kapanıyor.

### Yeni

- Otomatik yedekleme: açılışta, kapanışta, 5 dakikada bir ve her manuel yedekte kurulum klasöründeki `backups` dizinine zaman damgalı JSON + `latest.json` kopyası.
- Saklama politikası: bugün dahil son 7 takvim günü korunur, 8. güne giren dosyalar açılışta ve her yedekte silinir.
- Yedekten geri yükleme: veri boşsa son yedek kendiliğinden yüklenir; Yardım > Yedekleme ekranından eski yedek seçilebilir, klasör açılabilir.
- Yardım > Sürüm notları bölümünde **Güncellemeleri denetle**: kurulu sürümle GitHub'daki en yeni sürüm karşılaştırılır, ara sürümler atlanır, kurulum paketi indirilip başlatılır.
- **Bu sürümü atla**: atlanan sürüm için tekrar sorulmaz, daha yenisi çıkınca hatırlatılır.
- Açılışta 12 saatte bir sessiz güncelleme denetimi.

## [1.0.0] - 2026-11-04

### Yeni

- Personel26 esintili koyu lacivert arayüz: cam paneller, cyan vurgular, Inter + Space Grotesk tipografi ve Lucide ikon seti.
- Stok raporu, ürünler, hareketler, alımlar, tedarikçiler, pivot tablo, çıktı merkezi, yedekleme ve istatistik ekranları yeni tasarımla yenilendi.
- Yardım merkezi: 5 resimli kılavuz, numaralı ekran görüntüsü işaretleri ve adım listesi.
- Türkçe sesli anlatımlı 9 adımlı rehber turu; ses kapalıyken altyazı ve zamanlayıcıyla ilerler.
- Panel içinde sürüm notları, güncel kurulum paketi bağlantısı ve web sürümü kısayolu.
- Windows için çift tıklamayla kurulan NSIS paketi (kurulum klasörü seçilebilir, masaüstü ve başlat menüsü kısayolları).
- GitHub Pages üzerinde çalışan statik web sürümü; veriler tarayıcıda yerel kalır.
- `npm run release` ile sürüm yükseltme, sürüm notu, web derlemesi ve Windows kurulum paketi tek komutta.
