# ZzWorld — Tasarım Dokümanı

> Durum: **Fikir aşaması** · Son güncelleme: 2026-10-26
>
> Bu doküman netleşen kararları ve önerilen mimariyi toplar. Kod henüz yazılmadı;
> burada anlatılan teknik yapı, uygulama sırasında değişebilir. Kesinleşmiş ürün
> kararları [Karar Günlüğü](#22-karar-günlüğü) bölümünde ayrıca listelenir.

## İçindekiler

1. [Vizyon](#1-vizyon)
2. [Temel İlkeler](#2-temel-i̇lkeler)
3. [Platform ve Teknoloji](#3-platform-ve-teknoloji)
4. [Dünya Yapısı](#4-dünya-yapısı)
5. [Nesne Modeli (Polimorfizm)](#5-nesne-modeli-polimorfizm)
6. [Olay → Tepki → Eylem Sistemi](#6-olay--tepki--eylem-sistemi)
7. [Görsel Tarz: El Çizimi](#7-görsel-tarz-el-çizimi)
8. [Animasyon](#8-animasyon)
9. [Ses](#9-ses)
10. [Müzik](#10-müzik)
11. [Ajanlar (Hayvanlar)](#11-ajanlar-hayvanlar)
12. [Araçlar](#12-araçlar)
13. [Dünya Durumu: Zaman, Mevsim, Hava ve Işık](#13-dünya-durumu-zaman-mevsim-hava-ve-işık)
14. [Karakterler](#14-karakterler)
15. [ZzStudio — Nesne Üretici](#15-zzstudio--nesne-üretici)
16. [İçerik Paketleri](#16-i̇çerik-paketleri)
17. [Dil Desteği](#17-dil-desteği)
18. [Gizlilik, Güvenlik ve Ebeveyn Bölümü](#18-gizlilik-güvenlik-ve-ebeveyn-bölümü)
19. [Kayıt Sistemi](#19-kayıt-sistemi)
20. [Yol Haritası](#20-yol-haritası)
21. [Açık Sorular](#21-açık-sorular)
22. [Karar Günlüğü](#22-karar-günlüğü)

---

## 1. Vizyon

ZzWorld; Toca Boca World ve Avatar World tarzında, çocuklara yönelik bir **serbest
oyun (sandbox) dünyasıdır**. Çocuk karakter oluşturur, evleri ve sokakları düzenler,
şehirde gezer, hayvanlarla ilgilenir ve kendi hikâyelerini kurar.

- **Tamamen ücretsiz ve açık kaynak.** GitHub'da herkese açık geliştirilir.
- **Reklam yok, veri toplama yok, hesap yok, uygulama içi satın alma yok.**
- **Tarayıcıda çalışır**, PWA olarak cihaza kurulur ve çevrimdışı oynanır.
- **Yaratıcılığa açık:** oyundaki her şey, oyunla birlikte gelen ZzStudio aracıyla
  üretilir. Kullanıcılar da aynı araçla kendi nesnelerini, hayvanlarını, seslerini
  ve müziklerini yapabilir.

## 2. Temel İlkeler

1. **Kaybetme ve ceza yok.** Hiçbir şey ölmez, hastalanmaz, kaçmaz, kalıcı olarak
   bozulmaz. Puan, para, kilit yok. Çocuk hiçbir şeyi "yanlış" yapamaz.
2. **Yazısız arayüz.** Oyun içi arayüz ikonlarla çalışır; okuma bilmeyen çocuk da
   oynayabilir. (Ebeveyn bölümü ve ZzStudio bu kuralın dışındadır.)
3. **Dokunmatik öncelikli.** Ana hedef tablettir; büyük dokunma alanları, sürükle-bırak
   etkileşimi. PC (fare) ikinci hedeftir.
4. **Veri cihazdan çıkmaz.** Kayıtlar, ses kayıtları ve kullanıcı içerikleri yalnızca
   cihazda saklanır. Paylaşım sadece kullanıcının elle dışa aktardığı dosyalarla olur.
5. **Her şey veridir.** Nesneler, sahneler, davranışlar JSON tanımlarıdır. Motor bu
   tanımları yorumlar; yeni içerik kod yazmadan eklenir.
6. **Kendi aracımızı kullanırız (dogfooding).** Core içerik, kullanıcılara sunulan
   ZzStudio ile üretilir.

## 3. Platform ve Teknoloji

| Konu | Karar / Öneri |
|---|---|
| Çalışma ortamı | Tarayıcı, PWA (manifest + service worker) |
| Dil | Sade JavaScript (ES modules), build adımı yok. İhtiyaç olursa Vite'a geçilir. |
| Çizim | Önerilen: Canvas 2D + vektör verinin bitmap önbelleğe çizilmesi. Sahneler ağırlaşırsa PixiJS değerlendirilir. |
| El çizimi | [perfect-freehand](https://github.com/steveruizok/perfect-freehand) (MIT) çizgiler, [Rough.js](https://github.com/rough-stuff/rough) (MIT) dolgular |
| Ses / müzik | Web Audio API (sentez, efekt, kayıt oynatma) |
| Mikrofon | `getUserMedia` + `MediaRecorder` |
| Yerel kayıt | IndexedDB |
| Girdi | Pointer Events (dokunma, kalem, fare tek API) |

### Barındırma

- **Lokal geliştirme:** Apache, `http://192.168.1.102/ZzWorld/` (dosyalar
  `C:\Apache24\htdocs\ZzWorld` klasöründen doğrudan servis edilir).
- **HTTPS zorunluluğu:** Service worker (çevrimdışı/kurulum) ve mikrofon erişimi
  yalnızca HTTPS veya `localhost` üzerinde çalışır. Lokal ağdaki tabletlerden test
  için Apache'ye **mkcert** ile yerel sertifika eklenecek ve kök sertifika test
  cihazlarına yüklenecek.
- **Herkese açık sürüm:** GitHub Pages (HTTPS hazır gelir).

### Dış bağımlılıklar
CDN kullanılmaz. Kütüphaneler (perfect-freehand, Rough.js) `vendor/` altına kopyalanır.
Sebepler: çevrimdışı çalışma, CSP ile dış bağlantıların kapalı olması (bkz. §18) ve
sürümün sabit kalması.

### Lisans
- **Kod:** MIT ([LICENSE](../LICENSE)).
- **Core içerik** (`content/core/` altındaki görseller, sesler, müzikler): CC BY 4.0
  ([LICENSE-CONTENT.md](../LICENSE-CONTENT.md)).
- **Kullanıcı paketleri:** kendi lisanslarını `manifest.json` içinde belirtir.

### Klasör yapısı (öneri)

```
ZzWorld/
├─ index.html               oyun
├─ manifest.webmanifest
├─ sw.js                    service worker
├─ studio/index.html        ZzStudio
├─ src/
│  ├─ engine/               sahne, Entity, Behavior, Action, registry, girdi, çizim
│  ├─ game/                 oyun ekranları: dünya seçimi, harita, sokak, bina,
│  │                        karakter oluşturucu, ebeveyn bölümü
│  ├─ studio/               ZzStudio editörleri
│  ├─ audio/                ses motoru, sentez, sequencer
│  └─ shared/               i18n, depolama (IndexedDB), paket biçimi
├─ content/core/            core paketi: manifest.json, defs/, art/, sounds/, music/
├─ locales/                 tr.json, en.json
├─ vendor/                  üçüncü parti kütüphaneler
└─ docs/
```

## 4. Dünya Yapısı

```
Şehir Haritası ──dokun──► Mahalle ──► Sokak (yan kaydırmalı) ──kapı──► Bina ──► Odalar
                                         ▲  kavşakta ileri/geri  ▼
                                       Yan sokak
```

### 4.1 Şehir haritası
El çizimi, kuşbakışı bir harita. Mahalleler büyük, dokunulabilir alanlardır. Dokunulan
mahalleye girilir. Mahalleler arası geçiş her zaman harita üzerinden yapılır.

### 4.2 Mahalle ve sokaklar
- Mahalle bir **sokak grafıdır**: düğümler sokaklar, kenarlar kavşaklardır.
- Her sokak, **iki boyutlu, sağa-sola kaydırılan** uzun bir sahnedir.
- Sokak üzerindeki **kavşak noktalarında** ileri/geri hareketle (yukarı/aşağı kaydırma
  veya yerdeki ok işareti) yan sokağa geçilir. Geçişte kısa bir "derinliğe dönme"
  kamera animasyonu oynar.
- Mahallenin bir veya birkaç **çıkış noktası** vardır (otoyol tabelası, köprü);
  buradan şehir haritasına çıkılır.

### 4.3 Sahne katmanları

Her sahne önden arkaya şu katmanlardan oluşur:

```
 8  Ön plan        ağaç dalı, çit (yarı saydam olabilir)
 7  Eşyalar        serbest nesneler, karakterler, hayvanlar
 6  Mobilya
 5  Zemin + duvar  iç mekânda pencere/kapı yerlerinde açıklık (delik) var
 ─────────── Arka Plan (backdrop) ───────────
 4  Yakın manzara  sokak, ağaçlar, evler        (paralaks ~0.5)
 3  Uzak manzara   dağlar / şehir silüeti       (paralaks ~0.2)
 2  Bulutlar       yavaşça süzülür              (paralaks ~0.1)
 1  Güneş / Ay     güneş/ay düğmesiyle doğar-batar
 0  Gökyüzü        gündüz mavi, gece yıldızlı
```

- **Pencereler gerçek açıklıktır:** duvar, pencerenin `opening` alanında delik bırakarak
  çizilir; arkadan sahnenin arka planı paralaksla görünür. Pencere taşınınca görünen
  manzara da doğru yerden görünür. Gece pencereden yıldızlar görünür.
- **Sokak sahnelerinde** duvar yoktur; arka planın önünde bina cepheleri, kaldırım
  ve yol katmanları bulunur.

### 4.4 Arka planlar (backdrop)

Arka plan ayrı bir içerik türüdür (`"kind": "backdrop"`); katmanlardan oluşur ve
her katman türü polimorfik bir sınıftır (`Sky`, `Stars`, `SunMoon`, `Clouds`, `Art`…).

- **ZzStudio'da Arka Plan Editörü:** katman ekleme, çizme, paralaks oranı,
  gündüz/gece varyasyonu (ör. gece yanan pencereler), hareketli öğeler.
- **Seçim kalıtımla otomatik, gerekirse elle:**
  ```
  Şehir varsayılanı → Mahalle teması → Sokak → Bina → Oda
  ```
  Sahnede arka plan seçilmemişse bir üst seviyeninki kullanılır. Bina içindeki odalar
  binanın bulunduğu sokağın arka planını alır; pencereden doğru sokak görünür.
  Harita ve mahalle editöründe her seviyede elle seçilebilir.
- **Mahalle temaları:** sahil (deniz, martılar), dağ köyü (dağlar, çamlar),
  şehir merkezi (gökdelen silüeti).

### 4.5 Sokak katmanları
1. Arka plan (yukarıdaki backdrop)
2. Bina cepheleri (kapılar, pencereler)
3. Kaldırım: karakterler, hayvanlar
4. Yol: araçlar
5. Ön plan: ağaç, direk, çit

### 4.6 Binalar ve odalar
Sokaktaki kapı bir `Portal` nesnesidir; dokununca veya karakter kapıya bırakılınca
bina sahnesi açılır. Bina içinde odalar yan yana dizilir; katlar arası geçiş merdiven
veya asansör (yine `Portal`) ile olur.

**Uygulanan (6. adım):** ilk ev üç odadır — salon (`core.scene.room`), yatak odası ve
banyo — ve her oda ayrı bir sahnedir.

- **Kapı** (`class: "Portal"`, `Doorway` davranışı): her kapının odasında tek bir
  anahtarı (`door`) ve karşı odadaki kapıyı gösteren hedefi (`target`) vardır. Kapalı
  kapıya dokununca açılır; açık kapıya dokununca o odaya geçilir. Açık kapıya bırakılan
  eşya karşı odaya gider; karakter giderse görüntü onu takip eder. Karakterin elindeki
  ve üstündekiler de birlikte taşınır. Kapılar duvar boyunca kayar, çöpe atılamaz.
- Kapıların üstünde odayı resimle anlatan **levhalar** vardır (yatak, küvet, koltuk).
- **Kayıt:** gezilen her oda dünyada ayrı saklanır; oyun en son kalınan odada açılır.
  Eski kayıtlarda eksik olan kapılar şablondan eklenir, hiçbir oda ulaşılamaz kalmaz.
- Odadan çıkınca o odadaki döngüler ve radyolar durur; girilen odadaki lambalar günün
  zamanına uyar.
- **Yatak** (`Seat`, `pose: "sleep"`): karakter battaniyenin altına yan yatar, uykulu
  olur. **Küvet:** karakterler köpüklerin arasında oturup güler; ördek ve oyuncaklar
  suda yüzer. Lavabo açılıp kapanır, su akar.
- Yeni eşyalar: yatak, oyuncak sandığı, ayıcık, resim, küvet, lavabo, ayna, lastik
  ördek (`tools/gen-house.mjs`).

### 4.7 İlk mahalle
İlk sürümdeki mahallede iki mekân türü bulunur:
- **Evler:** karakterlerin yaşadığı, odaları olan binalar. İlk sürümün merkezi.
- **Park:** ağaçlar, salıncak, havuz; ortam hayvanları (kuş, sincap, ördek) için
  ana alan.

Market, veteriner gibi diğer mekânlar sonraki sürümlere bırakılmıştır.

### 4.8 Sahneler arası taşıma
Karakterler, eşyalar ve hayvanlar sahneler arasında taşınabilir (karakterin elinde,
araçta veya ekran kenarındaki bir "çanta" alanında).

## 5. Nesne Modeli (Polimorfizm)

Oyundaki her şey `Entity`'dir. Derin sınıf ağacı yerine **az sayıda temel tür +
takılıp çıkarılabilen davranışlar** kullanılır. Tümü ortak arayüze uyar; motor bir
nesnenin ne olduğunu bilmeden onu çalıştırır.

### 5.1 Temel türler

```
Entity        ortak arayüz: render, onTap, onDragStart, onDrop, onTick, serialize
 ├─ Item        taşınabilir: elma, oyuncak, telefon
 ├─ Furniture   yerleştirilir: yatak, buzdolabı, masa (sadece zemine oturur)
 ├─ Decor       duvar süsleri: tablo, saat, raf (yerçekimi yok, duvarda kalır)
 │   └─ Structure   yapısal: pencere, kapı (duvarda açıklık bırakır, silinemez)
 ├─ Agent       beyni olan nesne (bkz. §11)
 │   ├─ Character   oyuncu karakterleri (beyin: oyuncu kontrolü / serbest)
 │   └─ Animal      evcil ve ortam hayvanları
 ├─ Vehicle     binilir, hareket eder (bkz. §12)
 └─ Portal      kapı, merdiven, asansör, mahalle çıkışı
```

### 5.2 Davranışlar (Behavior)

Nesneye eklenen, aynı arayüzü paylaşan modüller:

| Davranış | Görev |
|---|---|
| `Toggle` | durumlar arasında geçiş (açık/kapalı) |
| `Container` | içine nesne konur (buzdolabı, bagaj, çanta) |
| `Seat` | karakter/hayvan oturur, yatar, biner |
| `Consumable` | yenir/içilir (ısırık izleri), geri gelir |
| `Light` | ışık kaynağı (gece katmanında parlar) |
| `Grow` | büyür, solar, sulanınca canlanır |
| `Spawner` | nesne üretir (musluk → su damlası) |
| `Motion` | kendi başına hareket (araç sürüşü) |
| `Affordance` | ajanlara bir ihtiyacı karşıladığını ilan eder (bkz. §11) |
| `Wearable` | karaktere giyilir (bkz. §14.4) |
| `SoundModifier` | içine atılan sesi değiştirir (papağan, robot) |

### 5.3 Nesne tanımı

Tanımlar saf JSON'dur. `extends` ile başka bir tanımdan miras alınır (veri düzeyinde
prototip kalıtımı). `class` ve `behaviors[].type` alanları, koddaki bir **kayıt
defterinden (registry)** ilgili sınıfa bağlanır.

```json
{
  "id": "core.fridge",
  "extends": "core.furniture.base",
  "class": "Furniture",
  "name": { "tr": "Buzdolabı", "en": "Fridge" },
  "art": { "states": { "closed": "…", "open": "…" } },
  "colorSlots": ["body", "handle"],
  "anchors": { "shelf1": [12, 40], "shelf2": [12, 80] },
  "behaviors": [
    { "type": "Toggle", "states": ["closed", "open"] },
    { "type": "Container", "slots": 6, "visibleIn": "open" }
  ],
  "reactions": { "…": "bkz. §6" }
}
```

- **Kimlikler** paket adıyla başlar (`core.`, `ayse.`), paketler birbirini ezmez.
- **Renk yuvaları** (`colorSlots`): yuva adı → varsayılan renk. Çizimde `"$body"` gibi
  başvurulur; çocuk oyun içinde nesneyi bu bölgelerden boyar.
- **Yüzeyler** (`surfaces`): üstüne eşya konabilen alanlar (masa üstü, raf).
- **Ön çizim** (`artFront`): kabın içindekilerin önüne çizilen kısım (sepetin ön yüzü).
- **Çapa noktaları** (`anchors`): eşyanın konacağı, karakterin oturacağı, elin tutacağı
  yerler.
- Yeni bir davranış = tek bir sınıf + kayıt. ZzStudio onu otomatik listeler.

### 5.4 Hareketlilik ve modlar

Her nesnenin bir **hareketlilik** (`mobility`) değeri vardır; varsayılanı türünden gelir,
tanım değiştirebilir.

| Değer | Varsayılan türler | Oyun modu | Düzenleme modu |
|---|---|---|---|
| `free` | `Item` (elma, top, sepet) | taşınır | taşınır |
| `edit` | `Furniture`, `Decor`, `Structure` | yerinde durur, dokunulur | taşınır |
| `locked` | — | yerinde durur | yerinde durur |

- **İki mod**, köşedeki yazısız bir düğmeyle değişir: **oyun modu** (dokun, aç-kapa,
  eşya taşı) ve **düzenleme modu** (oda düzeni). Düzenleme modunda taşınabilen
  büyük nesneler hafifçe sallanır.
- Oyun modunda taşınamayan bir nesneyi sürüklemek kamerayı kaydırır.
- `Decor` ve `Structure` duvarda kalır; duvar sınırları içinde taşınır.
- `Structure` (kapı, pencere, merdiven) yapısaldır: silinemez, kapılar yalnızca aynı
  duvar üzerinde kayar (`"slide": "x"`), çünkü başka sahnelere bağlantı noktasıdırlar.
- Kaplar (buzdolabı, sepet) yalnızca `free` nesneleri kabul eder.
- Düzenleme modunun sonraki parçaları: eşya kataloğu çekmecesi, çöp kutusu, boyama,
  duvar kâğıdı ve zemin seçimi.

## 6. Olay → Tepki → Eylem Sistemi

Ses, animasyon ve etkileşim tek bir omurgaya bağlanır: nesne bir **olaya** karşılık
bir **eylem listesi** çalıştırır.

- **Olaylar:** `tap`, `pickUp`, `drop`, `dropInto`, `stateEnter:<durum>`, `collide`,
  `idle`, `loop`, `timer`, `world:day`, `world:night`, `mood:<ruh hâli>`
- **Eylemler** (polimorfik sınıflar): `PlaySound`, `PlayAnim`, `PlayMusic`, `SetState`,
  `Spawn`, `Particles`, `Wait`, `Random`

```json
"reactions": {
  "tap":             [{ "do": "SetState", "toggle": ["closed", "open"] }],
  "stateEnter:open": [{ "do": "PlayAnim", "clip": "doorOpen" },
                      { "do": "PlaySound", "sound": ["creak1", "creak2"], "pitch": [0.9, 1.1] }],
  "loop":            [{ "do": "PlaySound", "sound": "hum", "volume": 0.2, "when": "closed" }],
  "world:night":     [{ "do": "SetState", "to": "lightOn" }]
}
```

ZzStudio'da bu yapı, kod gerektirmeyen Scratch benzeri bir **"…olunca → …yap"**
editörüyle düzenlenir.

## 7. Görsel Tarz: El Çizimi

- Çizimler **vektör** olarak saklanır: çizgiler nokta + basınç dizisidir,
  perfect-freehand ile mürekkep hissi verilir; dolgular Rough.js ile karakalem/pastel
  dokusundadır. Rastgelelik **sabit seed** ile üretilir (kareler arasında titremez).
- Vektör saklama sayesinde: her ekran çözünürlüğünde net görüntü, küçük dosyalar,
  oyun içinde renk yuvalarıyla boyama.
- Performans için vektörler sahne yüklenirken bir kez bitmap'e çizilip önbelleğe
  alınır.
- Kullanıcılar PNG/SVG çizimlerini de içe aktarabilir.

## 8. Animasyon

İlk sürümde **üç seviyenin hepsi** bulunur. Hepsi birer "animasyon klibi" türüdür;
`PlayAnim` eylemi klibin türünü bilmeden çalıştırır.

| Seviye | Açıklama | Örnek |
|---|---|---|
| 1. Hazır hareketler | Parametrik (genlik, süre, easing) | zıplama, sallanma, ezilip-uzama, dönme, titreme, nabız |
| 2. Parça animasyonu | Pivot noktaları etrafında keyframe | kapı açılması, pervane, yürüyüş, el sallama |
| 3. Kare kare (flipbook) | El çizimi kareler | alev, kanat çırpma, silkelenme |

### 8.1 Kare kare çizim
- ZzStudio'da kare şeridi, **soğan kabuğu (onion skin)**, kare başına süre
  (önerilen 8–12 kare/sn), döngü tipi (bir kez / döngü / ileri-geri).
- **Parça bazlı flipbook:** sadece bir parça (ör. kuyruk) kare kare çizilir, gövde
  parça animasyonuyla hareket eder.
- Renk yuvaları tüm karelerde korunur.
- Oyunda kareler sprite sheet olarak önbelleğe alınır.

### 8.2 Line boil
Tek kareli çizimler, motor tarafından 2–3 farklı seed ile döngüsel çizilerek "canlı
çizim" titreşimi kazanır. Oyunun imza görünümüdür.

### 8.3 Klip olayları
Klibin belirli bir karesine olay/ses bağlanabilir (ayak yere basınca "tık").
*(Henüz uygulanmadı.)*

### 8.4 Veri biçimi (uygulandı)

```json
{
  "parts": [{ "id": "blade", "pivot": [70, 70] }],
  "art": { "default": [ { "type": "ellipse", "...": "...", "part": "blade" } ] },
  "clips": {
    "spin": { "type": "keyframe", "duration": 0.45, "loop": true, "ease": "linear",
              "tracks": { "blade": [{ "t": 0, "rot": 0 }, { "t": 0.45, "rot": 360 }] } },
    "flicker": { "type": "frames", "fps": 7, "loop": true, "part": "flame",
                 "frames": [[ "...şekiller..." ], [ "..." ]] }
  },
  "idle": { "on": "spin" },
  "boil": true
}
```

- **Parçalar:** şekiller `part` alanıyla bir parçaya bağlanır; parçasız şekiller gövdedir.
  Çizim sırası korunur (ardışık aynı parçalı şekiller bir grup olur).
- **Anahtar kare izleri:** `tracks` parça adı → anahtar kareler (`t` saniye, `rot` derece,
  `x`, `y`, `s` ölçek). `""` izi bütün nesneyi hareket ettirir.
- **Kare kare:** `part` verilirse yalnızca o parçanın çizimi kare kare değişir; verilmezse
  bütün çizim.
- **`idle`:** sürekli dönen klip; tek bir ad ya da duruma göre (`{ "on": "spin" }`).
- **`boil`:** line boil açık/kapalı.
- `PlayAnim` hem hazır hareketleri hem nesnenin kendi kliplerini oynatır; `StopAnim`
  döngüyü durdurur.
- Core örnekleri: vantilatör (açıkken pervane döner), mum (alev kare kare titrer, ışık
  verir), saksı çiçeği (line boil).

## 9. Ses

### 9.1 Kaynaklar
1. **Sentez (ses üretici):** sfxr tarzı, hazır ayarlar (pop, zıplama, çan, damla, bip)
   + sliderlar + "rastgele" butonu. Sadece parametreler saklanır; lisans sorunu yok.
   Core efektlerin çoğu bununla üretilir.
2. **Mikrofon kaydı:** kırpma, seviye eşitleme, efektler (perde, yankı, robot).
3. **Dosyadan içe aktarma:** içe aktarılırken tek ortak formata dönüştürülür
   (iPad Safari uyumluluğu gözetilir).

### 9.2 Oyun içi davranış
- Varyasyon: birden çok ses arasından rastgele seçim + hafif perde farkı.
- Aynı anda çalan ses sayısına üst sınır.
- Ayrı kanallar: efekt / ortam / müzik (ebeveyn bölümünden ayarlanır).

### 9.3 Oyun içi mikrofon
- Mikrofon **varsayılan olarak kapalıdır**; ebeveyn bölümünden açılır.
- Mikrofon ayrı bir menü değil, dünyadaki bir **kayıt cihazı oyuncağıdır**: büyük
  buton basılı tutulunca kayıt alır, bırakınca durur.
- Kayıt bir **ses balonu** nesnesine dönüşür; bir nesnenin üstüne bırakılınca o
  nesneye `tap → PlaySound` tepkisi eklenir (konuşan kedi, kapı zili).
- **Ses değiştirici nesneler:** papağan (tekrarlar), telefon ahizesi, robot, mağara
  (yankı).
- Sınırlar: kayıt başına ~10 sn, toplam sayı/alan sınırı; silme çöp kutusu nesnesiyle.
- Mikrofon yalnızca butona basılıyken açıktır.

## 10. Müzik

### 10.1 ZzStudio: Döngü/Melodi Yapıcı
- **Adım ızgarası (step sequencer):** yatayda 8/16/32 adım, dikeyde notalar.
- **Gama kilitli:** varsayılan pentatonik (yanlış nota olmaz); majör, minör ve
  basitleştirilmiş makamlar (Hicaz, Uşşak…) seçilebilir.
- **İzler:** melodi, bas, akor/ped, davul.
- **Sentez enstrümanlar:** ksilofon, müzik kutusu, ukulele benzeri, flüt, marimba,
  yumuşak davul. Örnek ses dosyası yok, şarkılar birkaç KB.
- Mikrofon kayıtları enstrüman yapılabilir (perdelenmiş miyav).
- Tempo, swing, ses seviyeleri, "rastgele melodi öner".
- **Core müzikleri bu araçla üretilir.**

### 10.2 Oyunda müzik
- Her mahalle/iç mekân kendi döngüsünü tanımlar; sahne değişince yumuşak geçiş.
- Her şarkının isteğe bağlı **gece varyasyonu** vardır; güneş/ay düğmesiyle ritim
  bozulmadan geçilir.
- Radyo, gramofon gibi nesneler `PlayMusic` ile çalar; kullanıcı kendi şarkısını
  yükleyebilir.
- Oyun içi enstrümanlar (piyano, ksilofon, davul) aynı sentez motorunu kullanır ve
  çalan müziğin gamına otomatik uyar.

### 10.3 Uygulanan (4. adım)

**Ses motoru** (`src/audio/`): efekt / ortam / müzik kanalları; ekrandaki konuma göre
stereo; aynı anda en fazla 10 efekt sesi; yankı ve robot efektleri.

**Nesne sesleri** (`def.sounds`), `PlaySound` önce bunlara, sonra hazır seslere bakar:

```json
"sounds": {
  "miyav": { "type": "sample", "wav": "<base64 WAV>", "pitch": 1.3, "echo": true },
  "bip":   { "type": "synth", "wave": "square", "from": 880, "to": 1200, "dur": 0.1 }
}
```

- Kayıtlar ve içe aktarılan dosyalar 22 kHz mono 16-bit WAV'a çevrilir (her tarayıcıda
  çalar), baştaki/sondaki sessizlik kesilir, ses düzeyi eşitlenir, en fazla 10 sn.
- Hazır sesler (`pop`, `boing`, `ding`, `whoosh`, `sparkle`…) sentez parametreleridir.

**Şarkılar** (`"kind": "song"`): `bpm`, `swing`, `steps`, `scale`, `root`, `tracks`
(melodi: `[adım, derece, uzunluk]`, davul: `[adım, "kick"]`), isteğe bağlı `night`
(tempo, enstrüman değişimi, susturma). Derece gama göre sayılır; yanlış nota yoktur.
Gamlar: pentatonik, majör, minör, Hicaz, Uşşak (basitleştirilmiş).

**Oyunda:** sahne `music` alanıyla fon müziği (ilk dokunuşta başlar), gece versiyonu
ölçü başında devreye girer; `PlayMusic` / `StopMusic` (radyo) fon müziğini kısar;
`Instrument` davranışı (ksilofon) dokunulan tuşa göre gamdaki notayı çalar.

**ZzStudio:** Sesler sekmesi (ses üretici: dalga, frekans, süre, titreme, merdiven,
çan, yankı, rastgele; mikrofonla kayıt; dosyadan içe aktarma; perde, yankı, robot) ve
ayrı **müzik yapıcı** sayfası (`studio/music/`: parçalar, adım ızgarası, tempo, gam,
ton, swing, gece versiyonu, rastgele melodi; şarkılar paketlerle birlikte dışa aktarılır).

Core: `core.song.room` (oda, gece versiyonlu), `core.song.radio`, radyo ve ksilofon.

## 11. Ajanlar (Hayvanlar)

İlk sürümde **yalnızca hayvan ajanlar** vardır. İnsan NPC'ler sonraki sürümlere
bırakılmıştır; mimari türden bağımsız kurulur, böylece insan NPC eklemek yeni bir
gövde şablonu ve ihtiyaç tanımından ibaret olur.

### 11.1 Beyin: ihtiyaç temelli seçim (utility AI)
- Her ajanın ihtiyaçları vardır: `açlık`, `uyku`, `oyun`, `sevgi`, `merak`.
- **Akıllı nesneler:** nesneler `Affordance` davranışıyla ne sunduklarını ilan eder
  (mama kabı → açlık, top → oyun, minder → uyku). Ajan çevresindeki seçeneklerden o an
  en yararlısını seçer. Yeni eşya eklemek, mevcut hayvanlara yeni davranış kazandırır.
- **Kişilik** sliderları (meraklı, ürkek, oyuncu, tembel) seçimleri ağırlıklandırır.

### 11.2 Ceza yok kuralı
- İhtiyaçlar **yalnızca ruh hâlini ve davranışı** etkiler. Hastalık, ölüm, kaçma yok.
- İhtiyaçlar bir alt sınırda durur ve kendiliğinden normale döner. Uzun süre
  oynanmasa bile hayvan kötü durumda bulunmaz; en fazla "özlemiş" olarak karşılar.
- Ruh hâli sayı/bar ile değil, görselle anlatılır: kulak, kuyruk, göz ifadesi,
  düşünce balonunda ikon. Bunlar animasyon sisteminde "ruh hâli katmanı"dır.

### 11.3 Hareket tipleri (polimorfik)

| Tip | Örnek | Özellik |
|---|---|---|
| Yürüyen | kedi, köpek, tavşan | zeminde dolaşır, eşyalara zıplar |
| Uçan | kuş, kelebek, güvercin | süzülür, tünek noktalarına konar |
| Yüzen | balık, kaplumbağa | akvaryum/havuz sınırında kalır |
| Tırmanan | sincap, kertenkele | ağaç ve duvar yüzeylerinde gezer |

### 11.4 Ajan türleri
- **Evcil hayvanlar:** bir haneye/karaktere aittir, adı vardır, kaydedilir. Sahibini
  takip edebilir, kucağa alınır, beslenir, sevilir, giydirilir.
- **Ortam ajanları:** kuş, güvercin, sincap, kelebek. Sahneye aittir, kendiliğinden
  belirir, dokununca kaçar (sonra geri gelir), kırıntıya gelir.

### 11.5 Simülasyon
- Yalnızca aktif sahne simüle edilir. Bir sahneye dönülünce geçen süreye göre durum
  hızlıca hesaplanır.
- Sahne başına ajan sayısı sınırlıdır.

### 11.6 Gelecek fikir
Çocuğun kendi karakterini "kendi başına dolaşsın" moduna alması (aynı ajan beyniyle).

## 12. Araçlar

İlk sürümde vardır.

- `Vehicle` = `Seat` (oturma çapaları) + `Motion` davranışı. Isteğe bağlı `Container`
  ile bagaj.
- **Binme/inme:** karakter araca sürüklenip bırakılır; dışarı sürüklenerek iner.
- **Sürüş:** ekran kenarında büyük ileri/geri okları (basılı tut) veya aracı
  sürükleme. Kamera aracı takip eder.
- **Kavşaklar:** yolda yukarı/aşağı oklar belirir, dokununca yan sokağa dönülür.
- **Ceza yok:** çarpışma, hasar, yakıt yok. Hayvanlar araçtan kenara çekilir.
- Bırakılan araç olduğu yerde kalır ve kaydedilir.
- **Mahalleler arası:** araç mahalle çıkışına varınca şehir haritası açılır; hedef
  mahalleye dokununca araç haritada yolu izleyerek gider ve o mahallenin giriş
  noktasına iner. İçindekiler araçla taşınır.
- Örnek araçlar: bisiklet, scooter, aile arabası, minibüs, dondurma kamyonu,
  itfaiye, at arabası.

## 13. Dünya Durumu: Zaman, Mevsim, Hava ve Işık

> Durum: ilk sürümü (gündüz/gece, tek ortam karartması, nokta ışık) motorda var.
> Bu bölümün geri kalanı ZzStudio'dan sonra uygulanacak.

### 13.1 Üç bağımsız eksen

| Eksen | Değerler |
|---|---|
| **Günün zamanı** | sabah, öğle, akşam, gece (4 aşama) |
| **Mevsim** | ilkbahar, yaz, sonbahar, kış |
| **Hava** | açık, bulutlu, yağmurlu, karlı, fırtınalı |

- Üçünü de **çocuk seçer**; gerçek saat ve tarihe bağlı değildir. Dünya geneli
  ortak durumdur ve dünyayla birlikte kaydedilir.
- Eksenler **birbirinden bağımsızdır**: yazın kar yağdırmak da serbesttir.
- **Gökyüzü düğmesi:** köşedeki güneş/ay düğmesine basınca yazısız büyük ikonlardan
  bir yelpaze açılır: 4 zaman, 4 mevsim ağacı (çiçekli, yeşil, turuncu, karlı),
  hava ikonları.
- Geçişler birkaç saniyelik yumuşak animasyondur.
- **Olaylar:** `world:time:<zaman>`, `world:season:<mevsim>`, `world:weather:<hava>`,
  `world:lightning` (ve geriye uyum için `world:day` / `world:night`). Nesneler
  tepki verebilir: lambalar yanar, şimşekte köpek saklanır, yağmurda camda damlalar
  belirir, sonbaharda ağaç yaprak döker, gece ajanları (ateş böceği, baykuş) belirir.
- Gece hayvanların uyku ihtiyacı daha hızlı artar; zorlama yoktur.
- Hiçbir durum bir şeyi kilitlemez; çocuk lambaları elle yine açıp kapatabilir.

### 13.2 Varyantlar: "yoksa varsayılan" kuralı

Nesneler ve arka planlar mevsime (ileride zamana/havaya) göre **varyant** taşıyabilir.
Varyant, `extends` gibi yalnızca değişen kısmı içerir; tanımlanmamışsa varsayılan
kullanılır. Tek tasarım varsa her mevsimde o görünür.

```json
{
  "id": "core.tree",
  "art": { "default": [ "...yeşil ağaç..." ] },
  "seasons": {
    "autumn": { "colorSlots": { "leaves": "#e8893a" } },
    "winter": { "art": { "default": [ "...karlı dallar..." ] } }
  }
}
```

- `"onlyIn": ["winter"]` ile bir nesne ya da katman yalnızca belirli mevsimlerde var
  olur (kardan adam, yılbaşı ışıkları, yaprak yığını).
- Aynı kural arka plan katmanlarında da geçerlidir.

### 13.3 Hareketli ve döngüsel katmanlar

- **Kaydırma döngüsü:** her katmana `"scroll"` hızı verilebilir (bulutlar, uzakta
  giden tren, akan nehir).
- **Kare kare döngü:** bayrak, yel değirmeni, dalgalar (§8 flipbook sistemi).
- **Hava katmanları** (polimorfik): `Rain` (rüzgâra göre eğik, yerde sıçrama), `Snow`
  (salınarak düşen taneler), `Lightning` (kısa parlama, ortam ışığı bir an tam
  gündüz; 0,5–2 sn sonra gök gürültüsü sesi), `Fog`.
- Hava katmanları sahnenin önünde de çizilir: iç mekânda yalnızca pencereden görünür,
  dışarıda her şeyin önünde yağar.
- **`Props` katmanı:** arka plan, sahnedeki nesne tanımlarının aynısından nesneler
  içerebilir (sokak lambası, yel değirmeni, kuş sürüsü). Işık ve ses üretir, varyant
  taşır; paralaksla uzakta durur ve dokunulamaz.

### 13.4 Işık modeli

- **Ortam ışığı:** zamana ve havaya göre seviye ve renk. Sabah yumuşak sarı, öğle tam
  beyaz, akşam turuncu-pembe, gece koyu mavi; bulutlu havada griye çalar; şimşekte
  bir an tam beyaz.
- **Işık kaynakları bir davranıştır (`Light`)**, ses üreten nesneler gibi:
  - türler: nokta (lamba), koni (sokak lambası, el feneri), titrek (mum, şömine,
    televizyon), renkli (disko topu, yılbaşı ışıkları)
  - `when` ile duruma bağlanır (lamba açıkken)
  - gündüz neredeyse görünmez, karanlık arttıkça belirginleşir: gündüz genel ışık,
    gece yalnızca ışık kaynakları
- **Katmanlı ışık:** her derinlik kendi ışığını alır; arka plandaki sokak lambası arka
  planı, odadaki lamba odayı aydınlatır.
- **Pencereden ışık:** gündüz pencereden yere eğik bir güneş lekesi düşer; gece
  dışarıda sokak lambası varsa odaya soluk ışık girer.

### 13.5 Ses

- Sesler ekrandaki konuma göre sağa-sola kayar (stereo); uzaktaki arka plan nesneleri
  daha kısık duyulur.
- Ortam sesleri zamana ve havaya bağlıdır (yağmur, gece cırcır böcekleri, kış rüzgârı).
  İç mekânda dış sesler boğuk duyulur, pencere/kapı açılınca netleşir.

## 14. Karakterler

### 14.1 Görünüm
- **Büyük kafalı, kısa gövdeli** sevimli oranlar. Yüz ifadeleri net görünür, tablette
  dokunması kolaydır.
- **Parçalı (katmanlı) yapı:** kafa, gövde, kollar, bacaklar; pivot noktalarıyla parça
  animasyonu.

### 14.2 Yaş grupları
| Yaş | Özellik |
|---|---|
| Bebek | Taşınır; beşiğe, puset ya da araca konur; yürümez, emekler. |
| Çocuk | Ana karakter tipi. |
| Yetişkin | Araç kullanabilir. |
| Yaşlı | Baston, gözlük gibi kendine özgü aksesuarlar. |

Her yaş grubu kendi iskelet şablonunu ve standart klip setini kullanır.

### 14.3 Kapsayıcılık
- **Ten ve saç çeşitliliği:** serbest ten rengi paleti; düz, dalgalı, kıvırcık, afro
  saç tipleri; çil, vitiligo.
- **Baş örtüsü ve kültürel giysiler:** baş örtüsü, takke, sari gibi kategoriler.
- **Yardımcı cihazlar:** gözlük, işitme cihazı, protez; tekerlekli sandalye `Vehicle`
  gibi çalışır (karakter oturur, sokakta gider).

Beden çeşitliliği (boy/kilo seçenekleri) ilk sürümde yoktur.

### 14.4 Kıyafetler
İki yol birlikte bulunur:
1. **Karakter oluşturucuda** menüden seçim.
2. **Dünyada nesne olarak:** kıyafetler dolapta durur, karaktere sürüklenip
   bırakılınca giydirilir. Kıyafet bir `Item`'dır ve `Wearable` davranışı taşır
   (hangi bölgeye giyildiği, hangi katmanda çizildiği).

Katmanlar: iç giyim yok; üst, alt, tek parça (elbise), ayakkabı, şapka/baş örtüsü,
gözlük, aksesuar.

### 14.5 Yüz ifadeleri
- İfadeler (mutlu, gülen, şaşkın, uykulu, üzgün, somurtkan) karakterin durumlarıdır.
- Başa dokununca ifade değişir; olaylar da ifadeyi değiştirir (kaldırınca şaşkın,
  yere konunca mutlu, giydirilince güler).

### 14.6 Davranış
- Standart animasyon klip seti (`idle`, `walk`, `sit`, `sleep`, `eat`, `wave`…); böylece
  kullanıcının çizdiği her karakter tüm eşyalarla uyumlu çalışır.
- Karakter elinde nesne tutabilir, oturabilir, yatabilir, araca binebilir.

### 14.7 Uygulanan (5. adım)

**Görünümden çizime.** Karakter (`class: "Character"`) sabit bir çizim yerine bir
**görünüm** (`look`) taşır: yaş, ten, saç ve saç rengi, göz stili ve rengi, üst, alt,
ayakkabı, başlık, gözlük, ekstralar ve parça renkleri. Görünüm, her ifade için bir çizim
ve parçalar (baş, kollar, bacaklar) içeren sıradan bir tanıma dönüştürülür; çizim,
animasyon ve dokunma diğer nesnelerle aynı yoldan çalışır.

**Parça kütüphanesi** (`"kind": "part"`, `content/core/defs/characters.json`): her parça
vücut bölgelerine (baş, gövde, kol, bacak, kalça) 0–100'lük kutularda çizilir, kutular
yaşa göre esnetilir; böylece bir şapka her yaşa uyar. Alanlar: `slot`, `ages`, `color`,
`covers` (elbise altı örter), `hidesHair` (başörtüsü), `replaces` (protez bacak),
`item` (çıkarılınca yere düşen giysi). Renkler: `$main`, `$skin`, `$hair`, `$eye`.

- Saç: kısa, uzun, kıvırcık, afro, topuz, at kuyruğu, örgü, perçem (bebek); 13 renk.
- Üst: tişört, kazak, atlet, elbise, kaftan, sari, bebek tulumu. Alt: pantolon, şort,
  etek, bez. Ayakkabı: spor, bot, sandalet, patik.
- Başlık: şapka, hasır şapka, bere, başörtüsü, takke, taç. Gözlük, güneş gözlüğü.
- Özellikler: çil, vitiligo, sakal, bıyık, işitme cihazı, protez bacak; 10 ten rengi.

**Davranışlar:** `Face` (başa/gövdeye dokunma), `Wearer` (kıyafet giydirme; eskisi yere
düşer), elde tutma (sağ eldeki `Container`), `Seat` (sandalye; karakter oturur, `sit`
pozu). Klipler: `idle`, `wave`, `jump`, `sit`, `dangle` (kaldırılınca bacak sallama).

**Karakter oluşturucu:** yazısız tam ekran; yaş, ten, saç, gözler, üst, alt, ayakkabı,
başlık, gözlük ve özellikler sekmeleri; resimli seçenekler, renk paletleri, zar
(rastgele), canlı önizleme (dokununca zıplar). Düzenleme modunda katalogdaki kişi karosu
yeni karakter yapar; bir karaktere dokunmak onu oluşturucuda açar.

**Odada:** gardırop (içinde kıyafetler), sandalye ve iki karakter.

Parça çizimleri `tools/gen-characters.mjs` ile üretilir. Henüz yok: yürüme, yatma, yemek
yeme; ZzStudio'da kendi saç/kıyafet parçalarını çizme; tekerlekli sandalye (araçlarla).

## 15. ZzStudio — Nesne Üretici

Oyundan ayrı bir PWA sayfası (`/ZzWorld/studio/`). Hem geliştirme ekibinin core içerik
üretim aracı, hem de kendi setini oluşturmak isteyen kullanıcılar içindir. Arayüzünde
yazı kullanılabilir (TR/EN).

### 15.1 Editörler
- **Nesne editörü:** el çizimi, katmanlar/parçalar, durumlar, renk yuvaları, pivot ve
  çapa noktaları, dokunma alanı, davranış seçimi ve parametreleri, TR/EN isimler.
- **Tepki editörü:** "…olunca → …yap" (kodsuz).
- **Animasyon editörü:** hazır hareketler, keyframe zaman çizelgesi, kare kare çizim.
- **Ses üretici:** sentez, mikrofon kaydı, içe aktarma, efektler.
- **Döngü/melodi yapıcı:** bkz. §10.1.
- **Ajan editörü:** gövde şablonu (dört ayaklı, kuş, balık, böcek…), parçaları çizme,
  ihtiyaçlar, kişilik, sesler.
- **Araç editörü:** araç şablonu, oturma çapaları, tekerlek animasyonu.
- **Mahalle editörü:** sokakları uzatma, kavşak ekleme, bina cephesi yerleştirme,
  cepheyi iç mekâna bağlama, çıkış noktaları.

### 15.2 Test
Her editörde canlı önizleme ve nesneyi bir test sahnesinde deneme.

### 15.3 v1'de olanlar
- **Çizim araçları** (polimorfik `Tool` sınıfları): kalem (basınca duyarlı,
  perfect-freehand), dolgu (serbest kapalı alan), dikdörtgen ve elips (Rough.js ile el
  çizimi görünüm), silgi, seç-taşı (öne/arkaya, çoğalt, sil, seçiliyi yeniden boyama),
  geri al / yinele.
- **Alan araçları:** yüzey, kap alanı, açıklık (pencere camı), ışık kaynağı.
- **Durumlar** (sekmeler; ekle, çift dokunarak yeniden adlandır, sil) ve kaplar için
  **ön çizim** katmanı.
- **Paneller:** Genel (TR/EN ad, kimlik, tür, boyut, hareketlilik), Renkler (renk
  yuvaları), Davranış (Toggle, Container, yüzeyler, açıklık, ışık), Tepkiler
  (olay → eylem listesi: ses, hareket, durum, bekle).
- **Nesnelerim:** yeni, hazır (core) nesneden kopya, sil; paket adı; `.zzpack` dışa ve
  içe aktarma. Nesneler değiştikçe IndexedDB'ye kendiliğinden kaydedilir.
- **Dene:** nesne, gerçek oyun motoruyla çalışan bir deneme odasında açılır.
- **Oyunla bağlantı:** Stüdyo'da kaydedilen nesneler oyunun düzenleme modundaki
  katalogda ilk sırada görünür.
- **Animasyon sekmesi:** line boil; parçalar (ekle, adlandır, kaldır; seçili şekli
  parçaya taşı) ve **Pivot** aracı; anahtar kare klipleri (iz başına anahtar kare
  tablosu: zaman, açı, x, y, ölçek); kare kare klipler (kare ekle/sil, soğan kabuğu,
  kareler arasında gezinme); duruma göre sürekli oynatma; ▶ ile tuvalde önizleme.
- **Sesler sekmesi** ve **müzik yapıcı**: bkz. §10.3.
- Henüz yok: klip karelerine ses bağlama, iç içe parçalar.

### 15.4 Oyunda katalog ve çöp kutusu
- Düzenleme modunda "+" düğmesi alttan bir katalog çekmecesi açar; ilk karo ZzStudio'yu
  açar, sonra kullanıcının nesneleri, sonra core nesneler gelir.
- Karoya dokununca yeni nesne odanın ortasına düşer; karo yukarı çekilince nesne
  parmakla birlikte odaya taşınır.
- Sol üstteki çöp kutusuna bırakılan nesne kaldırılır; içindekiler ve üstündekiler
  yere düşer. Yapılar (pencere, kapı) çöpe atılamaz; eski yerine dönüp "hayır" der
  gibi sallanır.
- Silinmiş bir Stüdyo nesnesini içeren kayıtlar yine açılır; o nesne atlanır.

## 16. İçerik Paketleri

- Paket biçimi: **`.zzpack`** (ZIP). İçinde `manifest.json` (kimlik, ad, yazar,
  sürüm, lisans), tanımlar, çizimler, sesler, müzikler.
- **`core` paketi** repoda durur ve oyunla gelir.
- Kullanıcı paketleri IndexedDB'de saklanır, açılıp kapatılabilir.
- **Paketler kod çalıştıramaz.** Sadece veri içerir; davranışlar yalnızca motorun
  kayıt defterindeki sınıflara başvurabilir.
- Paylaşım sunucu olmadan, dosya alışverişiyle olur.

## 17. Dil Desteği

- Türkçe ve İngilizce.
- Oyun arayüzü büyük ölçüde ikon tabanlıdır; kalan metinler `locales/tr.json`,
  `locales/en.json` dosyalarındadır.
- Nesne isimleri tanımların içinde çok dilli tutulur (`{ "tr": …, "en": … }`).
- Varsayılan dil cihaz dilinden alınır; ebeveyn bölümünden değiştirilir.

## 18. Gizlilik, Güvenlik ve Ebeveyn Bölümü

### 18.1 Güvenceler
1. **Ağ erişimi kapalı:** sayfalar `Content-Security-Policy` ile dış adreslere bağlantı
   kuramaz (ör. `connect-src 'self'`). Kod hatası veya kötü niyetli paket olsa bile
   tarayıcı veri göndermeye izin vermez.
2. Tüm veri (kayıtlar, ses kayıtları, paketler) yalnızca IndexedDB'de durur.
3. Yedek dışa aktarımında **ses kayıtları varsayılan olarak dahil edilmez**; ebeveyn
   isterse işaretler.
4. Paketler kod çalıştırmaz (bkz. §16).
5. Mikrofon yalnızca kayıt butonu basılıyken açıktır.
6. Analitik, reklam, hesap, sunucu yok.

### 18.2 Ebeveyn kapısı
**Yazıyla sorulan bir işlem:** "Yedi artı beş kaç?" gibi bir soru, seçilen dilde yazıyla
gösterilir ve rakamlı tuşlarla cevaplanır. Soru her seferinde rastgele seçilir.
Okuma bilmeyen çocuk geçemez.

### 18.3 Ebeveyn bölümü içeriği
- Mikrofon aç/kapa (varsayılan **kapalı**), tüm kayıtları silme
- Ses seviyeleri: efekt / ortam / müzik
- Dil: Türkçe / English
- Yedekleme ve içe aktarma, kullanıcı paketlerini yönetme
- "Bu oyun hiçbir veri göndermez" açıklaması, lisans ve kaynak kod bağlantısı

## 19. Kayıt Sistemi

- **Birden çok dünya:** açılışta el çizimi "dünya kartları" gösterilir (3–6 yuva).
  Kardeşler aynı tablette ayrı dünyalarla oynayabilir. Kartta dünyanın küçük resmi
  görünür, yazı yoktur.
- IndexedDB, otomatik kayıt.
- Her dünyanın durumu (sahneler, nesne konumları, karakterler, evcil hayvanlar,
  araçlar, gece/gündüz) JSON olarak serileştirilir.
- Kullanıcı paketleri ve ses kayıtları dünyalardan bağımsız, cihaz düzeyinde saklanır.
- Dışa/içe aktarma ile yedekleme ve cihazlar arası taşıma (ebeveyn bölümünden).
- Dünya silme yalnızca ebeveyn bölümünden yapılır.

## 20. Yol Haritası

Önerilen sıra (taslak):

0. ✅ **Altyapı:** repo, klasör yapısı, Apache üzerinde HTTPS (mkcert), PWA iskeleti.
1. ✅ **Motor çekirdeği:** sahne, Entity/Behavior kayıt defteri, sürükle-bırak,
   Olay → Tepki sistemi, IndexedDB kayıt. (Çizimler şimdilik düz vektör; el çizimi
   görünüm 2. adımda gelecek.)
   - ✅ Oyun/düzenleme modu, hareketlilik kuralları, katmanlı arka plan (gökyüzü,
     yıldızlar, güneş/ay, bulutlar, manzara), pencere açıklıkları, güneş/ay düğmesi,
     gece gölgesi ve ışıklar.
2. ✅ **ZzStudio v1:** el çizimi, durumlar, alanlar, tepki editörü, dışa/içe aktarma,
   deneme odası; oyunda katalog ve çöp kutusu; core nesnelere el çizimi efekti (§15.3).
   Parça/pivot ve çapa noktaları animasyon adımına kaldı.
3. ✅ **Animasyon:** hazır hareketler, parça/pivot ve anahtar kare animasyonu, kare kare
   çizim, line boil, sürekli döngüler; ZzStudio'da Animasyon sekmesi (§8.4, §15.3).
4. ✅ **Ses ve müzik:** ses üretici, mikrofon kaydı, döngü/melodi yapıcı, oyun içi ses
   motoru, radyo ve ksilofon (§10.3). Oyun içi mikrofon 10. adımda (ebeveyn kapısıyla).
5. ✅ **Karakterler:** parçalı karakter, 4 yaş, ifadeler, kıyafet ve aksesuarlar, giydirme,
   oturma, elde tutma ve karakter oluşturucu (§14.7).
6. ✅ **İlk ev:** salon, yatak odası, banyo; kapılarla oda geçişi, yatak, küvet ve yeni
   eşyalar (§4.6).
7. **Sokak ve mahalle:** yan kaydırma, kavşaklar, portal, şehir haritası.
8. **Ajanlar:** evcil ve ortam hayvanları.
9. **Araçlar.**
10. **Dünya durumu (4 zaman, mevsim, hava), ışık modeli, Props katmanı, ebeveyn bölümü, oyun içi mikrofon.**
11. **Yayın:** GitHub Pages.

## 21. Açık Sorular

- Çizim katmanı: Canvas 2D mi, PixiJS mi (prototipte tablet üzerinde ölçülecek).
- "ZzStudio" adı onay bekliyor.

## 22. Karar Günlüğü

| Tarih | Karar |
|---|---|
| 2026-10-26 | Oyunun adı **ZzWorld**. Toca Boca World / Avatar World tarzı, çocuklara yönelik sandbox. |
| 2026-10-26 | Tarayıcıda çalışan PWA, yerel veri kaydı. |
| 2026-10-26 | Tamamen ücretsiz ve açık kaynak; GitHub'da public. Reklam ve veri toplama yok. |
| 2026-10-26 | Ana hedef tablet, ardından PC. |
| 2026-10-26 | Görsel tarz: el çizimi. |
| 2026-10-26 | Nesne üretici araç (ZzStudio): hem geliştirme hem kullanıcıların kendi setleri için. |
| 2026-10-26 | Diller: Türkçe ve İngilizce. |
| 2026-10-26 | Nesneler polimorfizm ile üretilebilir olacak. |
| 2026-10-26 | Nesneler ses üretebilecek ve animasyon uygulanabilecek. |
| 2026-10-26 | Oyun içinde mikrofonla ses kaydı olacak; kayıtlar yalnızca cihazda kalacak. |
| 2026-10-26 | Mikrofon varsayılan kapalı; ebeveyn kapısından geçilerek ayarlardan açılır. |
| 2026-10-26 | Dünya: şehir haritası → mahalle → yan kaydırmalı sokaklar; kavşaklarda ileri/geri ile yan sokaklar. |
| 2026-10-26 | Oyunda ajanlar olacak (evcil hayvanlar, kuşlar vb.). |
| 2026-10-26 | Ajan ihtiyaçları yalnızca ruh hâli ve davranışı etkiler; cezalandırıcı sonuç yok. |
| 2026-10-26 | İlk sürümde yalnızca hayvan ajanlar; insan NPC'ler sonraki sürümlerde. |
| 2026-10-26 | Gece/gündüz, oyun içi güneş/ay düğmesiyle değişir. |
| 2026-10-26 | Araçlar ilk sürümde: karakter biner, sokakta gider, kavşaklarda döner; mahalleler arası geçiş harita üzerinden. |
| 2026-10-26 | Kare kare çizim animasyonu ilk sürümde (üç animasyon seviyesinin hepsi). |
| 2026-10-26 | Arka plan müziği olacak; ZzStudio'da döngü/melodi yapıcı; core müzikleri onunla üretilecek. |
| 2026-10-26 | Lisans: kod MIT, core içerik (görsel, ses, müzik) CC BY 4.0. |
| 2026-10-26 | Birden çok dünya (kayıt yuvası); açılışta dünya kartları. |
| 2026-10-26 | Ebeveyn kapısı: yazıyla sorulan işlem, rakamlı tuşlarla cevap. |
| 2026-10-26 | İlk mahallede evler ve park bulunur. |
| 2026-10-26 | Karakterler büyük kafalı, sevimli oranlarda. |
| 2026-10-26 | Yaş grupları: bebek, çocuk, yetişkin, yaşlı. |
| 2026-10-26 | Kıyafetler hem karakter oluşturucuda hem dünyada nesne olarak (sürükle-giydir). |
| 2026-10-26 | Kapsayıcılık: geniş ten/saç çeşitliliği, baş örtüsü ve kültürel giysiler, yardımcı cihazlar. Beden çeşitliliği ilk sürümde yok. |
| 2026-10-26 | Oyun ve düzenleme modu; büyük eşyalar ve yapısal nesneler yalnızca düzenleme modunda taşınır. Küçük eşyalar her zaman serbest. |
| 2026-10-26 | Sahne katmanlı: gökyüzü, güneş/ay, bulutlar, uzak/yakın manzara, duvar/zemin, mobilya, eşyalar, ön plan. |
| 2026-10-26 | Pencereler gerçek açıklık; içeriden arka plan (dış dünya) görünür. |
| 2026-10-26 | Arka planlar ayrı içerik türü; ZzStudio'da düzenlenir, harita kalıtımıyla otomatik seçilir, elle değiştirilebilir. |
| 2026-10-26 | Katman sistemi ve modlar ZzStudio'dan önce motora eklenecek. |
| 2026-10-26 | Dünya durumu üç bağımsız eksen: günün zamanı (4 aşama), mevsim, hava. Hepsini çocuk seçer; yazın kar da serbest. |
| 2026-10-26 | Nesne ve arka planlarda mevsim varyantları; tanımlanmamışsa varsayılan görünür. |
| 2026-10-26 | Döngüsel/hareketli katmanlar ve hava efektleri (yağmur, kar, şimşek, sis). |
| 2026-10-26 | Işık modeli: ortam ışığı + `Light` davranışlı ışık kaynakları; arka planlar da ışık/ses üreten nesneler içerebilir. |
| 2026-10-26 | Bu sistem önce dokümana; kodu ZzStudio'dan sonra. |
