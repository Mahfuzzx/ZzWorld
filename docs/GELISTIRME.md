# Geliştirme Ortamı

## Yerel sunucu

Proje, Apache'nin `htdocs` klasöründen doğrudan servis edilir; build adımı yoktur.

- Oyun: `https://192.168.1.102/ZzWorld/`
- ZzStudio: `https://192.168.1.102/ZzWorld/studio/`

`.htaccess` HTTP isteklerini HTTPS'e yönlendirir ve `.git` klasörünü dışarıya kapatır.

Üçüncü parti kütüphaneler `vendor/` altındadır (sürüm ve lisanslar
[vendor/README.md](../vendor/README.md)). Yeni bir dosya eklendiğinde `sw.js`
içindeki `PRECACHE` listesine eklenmeli ve `VERSION` artırılmalıdır.

## Testler

Motor (`src/engine/`) DOM'a bağımlı olmayan kısımları Node ile test edilir
(Node 22+ gerekir, bağımlılık yok):

```
npm test
```

Testler `content/core` paketindeki gerçek tanımları kullanır; bir tanım bozulursa
testler de yakalar.

Tarayıcı konsolunda `zz` nesnesi hata ayıklama için açıktır (ör. `zz.scene`,
`zz.save()`).

## Üretilen içerik

Bazı core içerikler elle değil scriptle üretilir; çizimi değiştirmek için scripti düzenleyip
yeniden çalıştırın:

```
node tools/gen-characters.mjs
node tools/gen-house.mjs
```

(`content/core/defs/characters.json`: karakter, saç/kıyafet/aksesuar parçaları,
giysiler, gardırop, sandalye; `house.json`: kapı, levhalar, yatak odası ve banyo eşyaları.)

## Geri bildirim sunucusu (PHP + SQLite)

Oyundaki geri bildirimler `api/feedback.php` adresine gider; `api/admin.php` onları
okuma sayfasıdır. PHP 8 ve `pdo_sqlite` gerekir.

1. **Veri klasörü:** veritabanı varsayılan olarak web kökünün üç üstündeki
   `zzworld-data/` klasörüne yazılır (`…/htdocs/ZzWorld/api` → `…/zzworld-data`).
   Sunucuda bu klasör web kökü içinde kalıyorsa ya da yazılamıyorsa
   `api/config.sample.php` dosyasını `api/config.local.php` olarak kopyalayıp
   `data_dir` değerini değiştirin. `config.local.php` git'e girmez.
2. **Okuma anahtarı:** `api/admin.php` adresini açın, en az 12 karakterlik bir anahtar
   yazın; sayfanın verdiği satırı `config.local.php` içindeki `admin_key_hash` alanına
   koyun. Anahtarın kendisi hiçbir yere kaydedilmez.
3. **Erişim kaydı:** geri bildirim adresi Apache erişim kaydına (IP adresleriyle)
   yazılmamalıdır. `httpd.conf` (veya site yapılandırması) içinde:
   ```
   SetEnvIf Request_URI "/api/feedback.php$" zz_nolog
   CustomLog "logs/access.log" common env=!zz_nolog
   ```
   (Mevcut `CustomLog` satırına `env=!zz_nolog` eklemek yeterlidir; SSL sitesinin
   kendi `CustomLog` satırı varsa ona da.)

`api/.htaccess` paylaşılan kodu, ayar dosyalarını ve veritabanı dosyalarını dışarıya
kapatır. Geri bildirimde yalnızca tarih (saat yok), tür, seçilen yüz/resimler veya
ebeveynin yazdığı metin (en fazla 1000 karakter), dil ve oyun sürümü saklanır; IP adresi,
tarayıcı bilgisi, çerez ya da kimlik saklanmaz. Kötüye kullanıma karşı yalnızca herkes için
ortak saatlik bir üst sınır vardır (`max_per_hour`).

## Neden HTTPS?

Service worker (çevrimdışı oyun, cihaza kurma) ve mikrofon yalnızca güvenli bağlamda
(HTTPS veya `localhost`) çalışır. Lokal ağda bunun için [mkcert](https://github.com/FiloSottile/mkcert)
ile üretilmiş bir sertifika kullanılır.

## Sunucu kurulumu (bir kez)

1. mkcert'i kur: `winget install FiloSottile.mkcert`
2. Yerel CA'yı oluştur ve Windows'a güvenilir olarak ekle (yönetici):
   ```
   mkcert -install
   ```
   Hata verirse: `certutil -addstore Root "%LOCALAPPDATA%\mkcert\rootCA.pem"`
3. Sertifikayı üret (`C:\Apache24\conf` içinde):
   ```
   mkcert -cert-file ssl.crt/mkcert.crt -key-file ssl.key/mkcert.key 192.168.1.102 localhost 127.0.0.1 ::1
   ```
4. `conf/extra/httpd-ssl.conf` içinde `SSLCertificateFile` ve `SSLCertificateKeyFile`
   satırlarını bu dosyalara yönlendir, `httpd -t` ile kontrol et, Apache'yi yeniden başlat.

Sertifika 26 Ocak 2029'da sona erer; o zaman 3. adım tekrarlanır.

> `rootCA-key.pem` dosyası **asla** paylaşılmaz ve repoya girmez. Cihazlara sadece
> `rootCA.pem` (açık sertifika) yüklenir.

## Test cihazlarına CA yükleme

Kök sertifika lokal ağda şu adresten indirilebilir:
`http://192.168.1.102/zzworld-rootCA.crt`

**iPad / iPhone**
1. Adresi Safari'de aç, profili indirmeye izin ver.
2. Ayarlar → Profil İndirildi → Yükle.
3. Ayarlar → Genel → Hakkında → Sertifika Güven Ayarları → mkcert sertifikası için
   tam güveni aç.

**Android**
1. Dosyayı indir.
2. Ayarlar → Güvenlik → Şifreleme ve kimlik bilgileri → Sertifika yükle →
   CA sertifikası. (Menü adları cihaza göre değişir.)
3. Chrome'u yeniden başlat.

**Başka bir Windows PC**
`certutil -addstore Root zzworld-rootCA.crt` (yönetici). Firefox kendi sertifika
deposunu kullanır; orada ayrıca içe aktarmak gerekir.

## Service worker ve önbellek

`sw.js` "önce ağ" stratejisi kullanır: sunucuya ulaşılabiliyorsa her zaman güncel
dosya gelir, ağ yoksa önbellekteki kopya kullanılır. Her istek sunucuya "değişti mi?"
diye sorar (`cache: 'no-cache'`); böylece sunucu uzun önbellek süresi gönderse bile
(ör. LiteSpeed'in 7 günlük `max-age` değeri) kurulu uygulama eski kodu çalıştırmaz.

Kurulu uygulama, ekrana her dönüşünde yeni sürüm var mı diye bakar; yeni service worker
devreye girince dünyayı kaydedip sayfayı bir kez yeniler.

## Yeni sürüm yayınlama

1. `sw.js` içindeki `VERSION` değerini artırın (her yayında; tablet ve telefonlardaki
   kurulu uygulamalar güncellemeyi bundan anlar). Yeni dosya eklendiyse `PRECACHE`
   listesine de ekleyin.
2. `src/shared/version.js` içindeki `APP_VERSION` değerini artırın (ebeveyn
   bölümünde ve geri bildirimlerde görünür).
3. Dosyaları sunucuya yükleyin ve önbellek başlıklarını kontrol edin:
   ```
   curl -sI https://worldzz.com/src/main.js
   ```
   `Cache-Control: no-cache` görünmelidir (`.htaccess` ayarlar; sunucu
   `mod_headers` desteklemiyorsa barındırma panelinden ayarlanmalıdır).

Bu düzenlemeden önce kurulmuş uygulamalar eski kodla çalıştığı için kendiliğinden
yenilenmez: tarayıcı yeni `sw.js` dosyasını en geç 24 saat içinde alır; uygulamanın
bir kez tamamen kapatılıp açılması yeter. Sonraki sürümler kendiliğinden gelir.

## Güvenlik kuralı (CSP)

Her HTML sayfasında `Content-Security-Policy` meta etiketi vardır; dış adreslere
bağlantı, dış script ve satır içi script/stil yasaktır. CDN kullanılmaz; kütüphaneler
`vendor/` altına konur.
