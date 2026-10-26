# Geliştirme Ortamı

## Yerel sunucu

Proje, Apache'nin `htdocs` klasöründen doğrudan servis edilir; build adımı yoktur.

- Oyun: `https://192.168.1.102/ZzWorld/`
- ZzStudio: `https://192.168.1.102/ZzWorld/studio/`

`.htaccess` HTTP isteklerini HTTPS'e yönlendirir ve `.git` klasörünü dışarıya kapatır.

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
dosya gelir, ağ yoksa önbellekteki kopya kullanılır. Önceden önbelleğe alınan dosya
listesi (`PRECACHE`) değiştiğinde `VERSION` artırılmalıdır.

## Güvenlik kuralı (CSP)

Her HTML sayfasında `Content-Security-Policy` meta etiketi vardır; dış adreslere
bağlantı, dış script ve satır içi script/stil yasaktır. CDN kullanılmaz; kütüphaneler
`vendor/` altına konur.
