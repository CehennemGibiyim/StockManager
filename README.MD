# StockManager

Ürün, stok, hareket, alım ve rapor yönetimi için koyu temalı, Türkçe operasyon paneli. Aynı kaynak iki biçimde çalışır:

- **Web sürümü:** https://cehennemgibiyim.github.io/StockManager/
- **Windows kurulum paketi:** [GitHub Releases](https://github.com/CehennemGibiyim/StockManager/releases/latest)

Tüm veriler yerel kalır; bulut hesabı, giriş veya sunucu gerekmez. Web sürümünde tarayıcı `localStorage`, Windows uygulamasında aynı depolama Electron'un yerel profilinde tutulur.

## Ekran görüntüsü

![Stok raporu](assets/help/dashboard.png)

## Özellikler

- Personel26 esintili cam panel arayüzü, Lucide ikonları, Inter + Space Grotesk tipografi.
- Ürün ekleme, düzenleme, silme; stok kodu, kategori, alt limit ve birim fiyat takibi.
- Stok giriş/çıkış hareketleri ve otomatik stok güncellemesi.
- Alım kayıtları, tedarikçi özetleri ve maliyet hesapları.
- Kritik/tükenen ürün uyarıları, kategori pivot tablosu ve istatistik grafikleri.
- CSV dışa aktarma, A4 yazdırma, JSON yedekleme ve geri yükleme.
- Yardım merkezi: 5 resimli kılavuz, numaralı ekran görüntüsü işaretleri ve adım listesi.
- Türkçe sesli anlatımlı 9 adımlı rehber turu. Ses kapalıysa altyazı ve zamanlayıcıyla ilerler.
- Panel içinde sürüm notları ve güncel kurulum paketi bağlantısı.

## Geliştirme

Gereksinim: Node.js 20 veya üzeri.

```bash
npm install
npm run dev          # http://localhost:5173
```

TypeScript kaynağı `src/main.ts`, stil `styles.css`, yardım merkezi `help.js` ve `help/guides.json` içindedir. `main.js` derlenmiş çıktıdır; doğrudan düzenlemeyin.

```bash
npm run typecheck    # tip kontrolü
npm run build:js     # src/main.ts -> main.js
npm run build:web    # statik site -> dist/web
npm run start:desktop
```

## Windows kurulum paketi

```bash
npm run dist:win
```

Çıktı: `release/StockManager-Setup-<sürüm>.exe`. NSIS kurulumu kurulum klasörünü seçmeye izin verir, masaüstü ve başlat menüsü kısayolları oluşturur. Kaldırma sırasında kullanıcı verileri silinmez.

## Yeni sürüm ve sürüm notu

Her değişiklikten sonra tek komutla sürümü yükseltip notları yazabilir ve güncel kurulum paketini üretebilirsiniz:

```bash
npm run release -- --patch --notes "Ürün arama hızlandırıldı|Yeni stok uyarıları eklendi"
```

- `--patch`, `--minor`, `--major`: sürüm seviyesi (varsayılan `patch`).
- `--notes "a|b|c"` veya `--notes-file notlar.txt`: sürüm notları.
- `--no-installer`: yalnızca web sürümünü derler.
- `npm run release:same -- --notes "..."`: sürüm numarasını değiştirmeden paketi yeniler.

Komut şunları yapar:

1. `package.json` ve `version.json` sürümünü günceller.
2. `CHANGELOG.md` dosyasına tarihli sürüm notu ekler.
3. `dist/web` statik çıktısını üretir.
4. `release/StockManager-Setup-<sürüm>.exe` kurulum paketini oluşturur.
5. `release/latest.json` dosyasına sürüm ve indirme bilgisini yazar.

Ardından sürümü etiketleyip gönderin:

```bash
git add -A
git commit -m "Sürüm v1.0.0: yeni arayüz ve sesli rehber"
git tag v1.0.0
git push origin main --tags
```

`v*` etiketi GitHub Actions üzerinde Windows kurulum paketini üretir ve Releases sayfasına yükler. `main` dalına yapılan push ise web sürümünü GitHub Pages'e yayınlar.

## GitHub Pages

Depo ayarlarında **Settings → Pages → Build and deployment → Source: GitHub Actions** seçili olmalıdır. `.github/workflows/pages.yml` her push'ta `dist/web` klasörünü yayınlar. Adres: `https://cehennemgibiyim.github.io/StockManager/`.

## Proje yapısı

```text
index.html               Uygulama kabuğu
styles.css               Tema ve responsive düzen
src/main.ts              TypeScript kaynak (veri, görünümler, formlar)
main.js                  Derlenmiş uygulama
help.js                  Yardım merkezi, kılavuz modalı, sesli tur
help/guides.json         Kılavuz adımları ve tur metinleri
assets/help/*.png        Gerçek panel ekran görüntüleri
assets/fonts, vendor     Yerel fontlar ve Lucide
electron/main.cjs        Masaüstü kabuk ve yerel statik sunucu
scripts/build-web.mjs    dist/web üretimi
scripts/release.mjs      Sürüm + installer akışı
version.json             Güncel sürüm, notlar, indirme bağlantısı
```

## Veri ve gizlilik

- Web sürümünde veriler yalnızca tarayıcının yerel depolamasında tutulur.
- Windows sürümünde veriler Electron kullanıcı profilinde tutulur.
- Dışarıya veri gönderilmez, analitik veya takip kodu yoktur.
- Yedekleme ekranından JSON yedeği alıp başka bilgisayarda geri yükleyebilirsiniz.

## Lisans

MIT
