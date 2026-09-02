# randevu-widget

Herhangi bir siteye **tek script etiketiyle** eklenen randevu kutusu.
Bağımlılığı yok, derleme adımı yok, Shadow DOM içinde çalışır.

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

## Neden bu üç karar

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

## Adaptör

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

## Görünüm

CSS değişkenleriyle ayarlanır, kaynak dosyaya dokunmadan:

```css
#randevu { --rw-vurgu: #1f7a55; --rw-yuvarlak: 8px; }
```

`--rw-zemin` `--rw-yuzey` `--rw-metin` `--rw-soluk` `--rw-cizgi` `--rw-vurgu`
`--rw-vurgu-zemin` `--rw-uyari` `--rw-onay` `--rw-yuvarlak`.
Karanlık tema hazır gelir, `prefers-reduced-motion` karşılığı var.
Bütün metinler `metin` seçeneğiyle değiştirilebilir.

## Test

```bash
node --test test/*.test.js     # slot aritmetiği: 12 vaka, tarayıcısız
node test/demo-dogrula.mjs     # arayüz: 11 vaka, gerçek tarayıcı (puppeteer-core gerekir)
```

Aritmetik testleri arasında yaz saati geçişi, kısmi çakışma, kapanışa taşan
slot ve gün adının işletme saat diliminde hesaplanması var. Bunların hepsi
sessiz kusurlardır: hiçbiri konsola bir şey yazmaz, yalnızca insan yanlış
saatte gelir.

## Lisans

MIT.
