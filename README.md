# randevu-widget

[![test](https://github.com/kerem-aydin/randevu-widget/actions/workflows/test.yml/badge.svg)](https://github.com/kerem-aydin/randevu-widget/actions/workflows/test.yml) ![dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen) ![license: MIT](https://img.shields.io/badge/license-MIT-blue)

A booking box you drop into any website with **a single script tag**.
No dependencies, no build step, runs inside a Shadow DOM.

**[Live demo](https://kerem-aydin.github.io/randevu-widget/demo/)**

```html
<div id="randevu"></div>
<script type="module">
  import { randevuWidget } from "./src/randevu-widget.js";

  randevuWidget(document.getElementById("randevu"), {
    isletme: "Example Clinic, Istanbul",
    calisma: {
      saatDilimi: "Europe/Istanbul",   // IANA time zone of the business
      acilis: "09:00", kapanis: "18:00",
      acikGunler: ["mon", "tue", "wed", "thu", "fri", "sat"],
      slotDakika: 30,
    },
    hizmetler: ["Check-up", "Cleaning"],
    adaptor: {
      dolu: (start, end) => fetch(`/api/busy?start=${start}&end=${end}`).then((r) => r.json()),
      yaz:  (booking)    => fetch("/api/book", { method: "POST", body: JSON.stringify(booking) }).then((r) => r.json()),
    },
  });
</script>
```

*(The API is named in Turkish because that is who it was written for.
`isletme` = business, `calisma` = working hours, `hizmetler` = services,
`adaptor` = adapter, `dolu` = busy, `yaz` = write.)*

## Three decisions, and why

**Shadow DOM.** The widget runs on somebody else's site, and that site's CSS can
override everything. The demo page attacks it on purpose: rules that paint every
button red, force Comic Sans, and put magenta borders on inputs. The widget is
unaffected, and a test measures that. "It looks broken on my site" is the number
one support ticket in this category of product.

**No dependencies.** Making a hair salon install React into their WordPress
theme creates a bigger problem than it solves. One file, `<script type="module">`.

**The clock belongs to the business.** `new Date("2026-09-10T14:00")` reads as
Berlin in a visitor's browser and as UTC on a server. Both are wrong, and the
bug surfaces as "the appointment moved by an hour" on the first complaint. Every
conversion goes through `Intl.DateTimeFormat` in the business's IANA time zone,
daylight saving transitions included.

## The adapter

The widget is not tied to any backend. It asks for two functions:

```js
dolu(startEpochMs, endEpochMs) -> [{ bas, bit }]   // busy ranges from the calendar
yaz({ iso, epoch, saatDilimi, dakika, ad, iletisim, hizmet })
  -> { ok: true } | { ok: false, sebep: "..." }
```

Google Calendar, Cal.com, your own API, or an email queue — all of them go
behind these two functions.

**No confirmation is shown when `ok: false`.** The sentence "your appointment is
confirmed" is only rendered after the adapter returns success, and then the list
refreshes. Showing a confirmation for a booking that was never written is the
worst thing this product can do: the person arrives and there is no record.

## Theming

Set through CSS variables, without touching the source:

```css
#randevu { --rw-vurgu: #1f7a55; --rw-yuvarlak: 8px; }
```

`--rw-zemin` `--rw-yuzey` `--rw-metin` `--rw-soluk` `--rw-cizgi` `--rw-vurgu`
`--rw-vurgu-zemin` `--rw-uyari` `--rw-onay` `--rw-yuvarlak`.
Dark theme ships by default, `prefers-reduced-motion` is honoured, and every
string can be replaced through the `metin` option.

## Tests

```bash
node --test test/*.test.js     # slot arithmetic: 12 cases, no browser
node test/demo-dogrula.mjs     # interface: 11 cases, real browser (needs puppeteer-core)
```

The arithmetic tests cover daylight saving transitions, partial overlaps, a slot
that runs past closing time, and the weekday being computed in the business's
time zone. All of these are silent defects: none of them log anything, a person
just shows up at the wrong hour.

## License

MIT.

---
---

## Türkçe

Herhangi bir siteye **tek script etiketiyle** eklenen randevu kutusu.
Bağımlılığı yok, derleme adımı yok, Shadow DOM içinde çalışır.

**[Canlı demo](https://kerem-aydin.github.io/randevu-widget/demo/)**

```html
<div id="randevu"></div>
<script type="module">
  import { randevuWidget } from "./src/randevu-widget.js";

  randevuWidget(document.getElementById("randevu"), {
    isletme: "Örnek Klinik, Kadıköy",
    calisma: {
      saatDilimi: "Europe/Istanbul",
      acilis: "09:00", kapanis: "18:00",
      acikGunler: ["mon", "tue", "wed", "thu", "fri", "sat"],
      slotDakika: 30,
    },
    hizmetler: ["Kontrol", "Diş temizliği"],
    adaptor: {
      dolu: (bas, bit) => fetch(`/api/dolu?bas=${bas}&bit=${bit}`).then((r) => r.json()),
      yaz:  (randevu) => fetch("/api/randevu", { method: "POST", body: JSON.stringify(randevu) }).then((r) => r.json()),
    },
  });
</script>
```

`demo/index.html` dosyasını bir sunucuyla açın; bellekte çalışan bir takvimle
uçtan uca denenebiliyor.

### Neden bu üç karar

**Shadow DOM.** Widget başkasının sitesinde çalışıyor ve o sitenin CSS'i her
şeyi ezebilir. Demo sayfası bunu bilerek zorluyor: bütün butonları kırmızıya
boyayan, yazı tipini Comic Sans yapan, inputlara macenta çerçeve koyan kurallar
var. Widget hiçbirinden etkilenmiyor ve test bunu ölçüyor. Bir widget'ın
"müşteride bozuk görünmesi" bu işin bir numaralı destek talebidir.

**Bağımlılık yok.** Bir kuaförün WordPress temasına React kurdurmak,
çözdüğünden büyük bir sorun getirir. Tek dosya, `<script type="module">`.

**Saat dilimi işletmenin saati.** `new Date("2026-09-10T14:00")` ziyaretçinin
tarayıcısında Berlin, sunucuda UTC okunur; ikisi de yanlıştır ve hata "randevu
bir saat kaymış" diye, ilk şikayette ortaya çıkar. Bütün dönüşümler
`Intl.DateTimeFormat` ile işletmenin IANA saat dilimi üzerinden yapılıyor, yaz
saati geçişleri dahil.

### Adaptör

Widget hiçbir sunucuya bağlı değil. İki fonksiyon istiyor:

```js
dolu(basEpochMs, bitEpochMs) -> [{ bas, bit }]         // takvimdeki dolu aralıklar
yaz({ iso, epoch, saatDilimi, dakika, ad, iletisim, hizmet })
  -> { ok: true } | { ok: false, sebep: "..." }
```

Google Takvim, Cal.com, kendi API'niz ya da bir e-posta kuyruğu: hepsi bu iki
fonksiyonun arkasına girer.

**`ok: false` geldiğinde onay gösterilmez.** "Randevunuz oluşturuldu" cümlesi
yalnız adaptör başarı döndüğünde kurulur, ve liste tazelenir. Yazılamadığı
hâlde onay göstermek, bu ürünün yapabileceği en kötü şeydir: kişi gelir, kaydı
yoktur.

### Görünüm

CSS değişkenleriyle ayarlanır, kaynak dosyaya dokunmadan:

```css
#randevu { --rw-vurgu: #1f7a55; --rw-yuvarlak: 8px; }
```

`--rw-zemin` `--rw-yuzey` `--rw-metin` `--rw-soluk` `--rw-cizgi` `--rw-vurgu`
`--rw-vurgu-zemin` `--rw-uyari` `--rw-onay` `--rw-yuvarlak`.
Karanlık tema hazır gelir, `prefers-reduced-motion` karşılığı var.
Bütün metinler `metin` seçeneğiyle değiştirilebilir.

### Test

```bash
node --test test/*.test.js     # slot aritmetiği: 12 vaka, tarayıcısız
node test/demo-dogrula.mjs     # arayüz: 11 vaka, gerçek tarayıcı (puppeteer-core gerekir)
```

Aritmetik testleri arasında yaz saati geçişi, kısmi çakışma, kapanışa taşan
slot ve gün adının işletme saat diliminde hesaplanması var. Bunların hepsi
sessiz kusurlardır: hiçbiri konsola bir şey yazmaz, yalnızca insan yanlış
saatte gelir.

### Lisans

MIT.
