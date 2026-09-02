/**
 * RANDEVU WIDGET — bir siteye tek script etiketiyle eklenen randevu kutusu.
 *
 *   <div id="randevu"></div>
 *   <script type="module">
 *     import { randevuWidget } from "./src/randevu-widget.js";
 *     randevuWidget(document.getElementById("randevu"), {
 *       isletme: "Örnek Klinik",
 *       calisma: { saatDilimi: "Europe/Istanbul", acilis: "09:00", kapanis: "18:00",
 *                  acikGunler: ["mon","tue","wed","thu","fri"], slotDakika: 30 },
 *       hizmetler: ["Kontrol", "Temizlik"],
 *       adaptor: benimAdaptorum,
 *     });
 *   </script>
 *
 * ── Neden Shadow DOM ─────────────────────────────────────────────────────────
 * Widget başkasının sitesinde çalışıyor ve o sitenin CSS'i her şeyi ezebilir:
 * `* { box-sizing }`, `button { all: unset }`, bir Bootstrap sürümü, eski bir
 * tema. Shadow DOM sınırı bunu tek hamlede kapatıyor. Bir widget'ın "müşteride
 * bozuk görünmesi" bu sektörde bir numaralı destek talebidir ve sebebi
 * neredeyse her zaman budur.
 *
 * ── Neden bağımlılık yok ─────────────────────────────────────────────────────
 * Tek dosya, derleme adımı yok. Bir kuaförün WordPress temasına React
 * kurdurmak, çözdüğünden büyük bir sorun getirir.
 *
 * ── Adaptör ──────────────────────────────────────────────────────────────────
 * Widget hiçbir sunucuya BAĞLI DEĞİL. İki fonksiyon istiyor:
 *   dolu(bas, bit) -> [{bas, bit}]     takvimdeki dolu aralıklar (epoch ms)
 *   yaz(randevu)   -> {ok:true} | {ok:false, sebep}
 * Google Takvim, Cal.com, kendi API'niz ya da bir e-posta: hepsi bu iki
 * fonksiyonun arkasına girer. `demo/` içinde bellekte çalışan bir örnek var.
 */

import { bosSlotlar, gunlereBol } from "./slotlar.js";

const VARSAYILAN_METIN = {
  baslik: "Randevu al",
  hizmet: "Ne için geliyorsunuz?",
  saat: "Uygun saatler",
  ad: "Adınız",
  iletisim: "Telefon ya da e-posta",
  gonder: "Randevuyu oluştur",
  gonderiliyor: "Yazılıyor",
  basarili: "Randevunuz oluşturuldu",
  bosSaat: "Önümüzdeki iki hafta için açık saat görünmüyor. Bize ulaşın, birlikte bakalım.",
  yukleniyor: "Uygun saatler getiriliyor",
  hataTakvim: "Takvime şu an ulaşılamadı. Biraz sonra tekrar deneyin.",
  hataYazma: "Randevu yazılamadı. Saati bir kez daha seçip deneyin.",
  zorunlu: "Bu alan gerekli",
  gecersizIletisim: "Telefon numarası ya da e-posta adresi girin",
  dahaFazla: "Daha fazla saat",
};

const BICIM = `
  :host { all: initial; display: block; color-scheme: light; }
  * { box-sizing: border-box; }
  .kutu {
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: var(--rw-metin, #17181c);
    background: var(--rw-zemin, #fbfaf8);
    border: 1px solid var(--rw-cizgi, #e2ded6);
    border-radius: var(--rw-yuvarlak, 14px);
    padding: 22px;
    max-width: 520px;
  }
  h2 { font-size: 19px; font-weight: 650; margin: 0 0 4px; letter-spacing: -0.01em; }
  .isletme { font-size: 13px; color: var(--rw-soluk, #6c6a63); margin: 0 0 18px; }
  fieldset { border: 0; margin: 0 0 18px; padding: 0; }
  legend {
    font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--rw-soluk, #6c6a63); padding: 0; margin-bottom: 8px;
  }
  .secenekler { display: flex; flex-wrap: wrap; gap: 7px; }
  .cip, .slot {
    font: inherit; font-size: 14px; cursor: pointer;
    border: 1px solid var(--rw-cizgi, #e2ded6);
    background: var(--rw-yuzey, #fff);
    color: inherit; border-radius: 9px; padding: 7px 13px;
    transition: border-color .18s cubic-bezier(.23,1,.32,1), background-color .18s cubic-bezier(.23,1,.32,1);
  }
  .cip[aria-pressed="true"], .slot[aria-pressed="true"] {
    border-color: var(--rw-vurgu, #1d4ed8);
    background: var(--rw-vurgu-zemin, #eef2ff);
    font-weight: 600;
  }
  .cip:focus-visible, .slot:focus-visible, button:focus-visible, input:focus-visible {
    outline: 2px solid var(--rw-vurgu, #1d4ed8); outline-offset: 2px;
  }
  .gun { margin-bottom: 12px; }
  .gun-ad { font-size: 13px; font-weight: 600; margin: 0 0 6px; }
  .slot { font-variant-numeric: tabular-nums; }
  label { display: block; font-size: 13px; margin-bottom: 5px; }
  input {
    font: inherit; width: 100%; padding: 9px 11px;
    border: 1px solid var(--rw-cizgi, #e2ded6); border-radius: 9px;
    background: var(--rw-yuzey, #fff); color: inherit;
  }
  .alan { margin-bottom: 12px; }
  .hata { color: var(--rw-uyari, #a3271b); font-size: 12.5px; margin: 5px 0 0; }
  .gonder {
    font: inherit; font-weight: 600; width: 100%; cursor: pointer;
    padding: 11px 16px; border: 0; border-radius: 10px;
    background: var(--rw-vurgu, #1d4ed8); color: #fff;
    transition: opacity .18s cubic-bezier(.23,1,.32,1);
  }
  .gonder[disabled] { opacity: .55; cursor: default; }
  .durum { font-size: 13.5px; color: var(--rw-soluk, #6c6a63); margin: 12px 0 0; }
  .basarili {
    border: 1px solid var(--rw-onay, #1f7a55); border-radius: 12px;
    padding: 18px; text-align: left;
  }
  .basarili h3 { margin: 0 0 6px; font-size: 17px; }
  .basarili p { margin: 0; font-size: 14px; color: var(--rw-soluk, #6c6a63); }
  .dahaFazla {
    font: inherit; font-size: 13px; background: none; border: 0; padding: 4px 0;
    color: var(--rw-vurgu, #1d4ed8); cursor: pointer; text-decoration: underline;
  }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  @media (prefers-color-scheme: dark) {
    .kutu {
      --rw-zemin: #16171a; --rw-yuzey: #1e2025; --rw-metin: #e8e7e3;
      --rw-cizgi: #33353c; --rw-soluk: #9b9a93; --rw-vurgu: #7ea6ff;
      --rw-vurgu-zemin: #232a3d; --rw-uyari: #e39182; --rw-onay: #6bbd97;
      color: var(--rw-metin);
    }
    .gonder { color: #12141a; }
  }
`;

const gecerliIletisim = (v) => {
  const t = String(v ?? "").trim();
  if (t.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t);
  const r = t.replace(/\D/g, "");
  return r.length >= 10 && r.length <= 13;
};

export function randevuWidget(hedef, ayar = {}) {
  if (!hedef) throw new Error("randevuWidget: hedef eleman gerekli");
  const metin = { ...VARSAYILAN_METIN, ...(ayar.metin ?? {}) };
  const calisma = ayar.calisma ?? { saatDilimi: "Europe/Istanbul" };
  const hizmetler = ayar.hizmetler ?? [];
  const adaptor = ayar.adaptor;
  if (!adaptor || typeof adaptor.dolu !== "function" || typeof adaptor.yaz !== "function") {
    throw new Error("randevuWidget: adaptor.dolu ve adaptor.yaz gerekli");
  }

  const golge = hedef.shadowRoot ?? hedef.attachShadow({ mode: "open" });
  golge.innerHTML = `<style>${BICIM}</style><div class="kutu" role="form" aria-label="${metin.baslik}"></div>`;
  const kutu = golge.querySelector(".kutu");

  const durum = {
    hizmet: hizmetler[0] ?? "",
    slot: null,
    ad: "",
    iletisim: "",
    slotlar: [],
    yukleniyor: true,
    gonderiliyor: false,
    hata: "",
    alanHatalari: {},
    tamam: null,
    genisGun: 7,
  };

  function ciz() {
    if (durum.tamam) {
      kutu.innerHTML = `
        <div class="basarili">
          <h3>${metin.basarili}</h3>
          <p>${durum.tamam.etiket}${durum.tamam.hizmet ? " · " + kacir(durum.tamam.hizmet) : ""}</p>
        </div>`;
      return;
    }

    const gunler = gunlereBol(durum.slotlar, calisma.saatDilimi, ayar.dil ?? "tr-TR");
    const gosterilen = gunler.slice(0, durum.genisGun);

    kutu.innerHTML = `
      <h2>${metin.baslik}</h2>
      <p class="isletme">${kacir(ayar.isletme ?? "")}</p>

      ${hizmetler.length ? `
      <fieldset>
        <legend>${metin.hizmet}</legend>
        <div class="secenekler" role="group">
          ${hizmetler.map((h) => `
            <button type="button" class="cip" data-hizmet="${kacir(h)}"
              aria-pressed="${h === durum.hizmet}">${kacir(h)}</button>`).join("")}
        </div>
      </fieldset>` : ""}

      <fieldset>
        <legend>${metin.saat}</legend>
        ${durum.yukleniyor ? `<p class="durum">${metin.yukleniyor}</p>` : ""}
        ${!durum.yukleniyor && durum.hata ? `<p class="hata">${kacir(durum.hata)}</p>` : ""}
        ${!durum.yukleniyor && !durum.hata && !gunler.length ? `<p class="durum">${metin.bosSaat}</p>` : ""}
        ${gosterilen.map((g) => `
          <div class="gun">
            <p class="gun-ad">${kacir(g.etiket)}</p>
            <div class="secenekler" role="group" aria-label="${kacir(g.etiket)}">
              ${g.slotlar.map((s) => `
                <button type="button" class="slot" data-iso="${s.iso}"
                  aria-pressed="${durum.slot?.iso === s.iso}">${s.saat}</button>`).join("")}
            </div>
          </div>`).join("")}
        ${gunler.length > durum.genisGun
          ? `<button type="button" class="dahaFazla">${metin.dahaFazla}</button>` : ""}
      </fieldset>

      <div class="alan">
        <label for="rw-ad">${metin.ad}</label>
        <input id="rw-ad" name="ad" autocomplete="name" value="${kacir(durum.ad)}">
        ${durum.alanHatalari.ad ? `<p class="hata">${durum.alanHatalari.ad}</p>` : ""}
      </div>

      <div class="alan">
        <label for="rw-iletisim">${metin.iletisim}</label>
        <input id="rw-iletisim" name="iletisim" autocomplete="tel" value="${kacir(durum.iletisim)}">
        ${durum.alanHatalari.iletisim ? `<p class="hata">${durum.alanHatalari.iletisim}</p>` : ""}
      </div>

      <button type="button" class="gonder" ${durum.gonderiliyor ? "disabled" : ""}>
        ${durum.gonderiliyor ? metin.gonderiliyor : metin.gonder}
      </button>
      ${durum.alanHatalari.genel ? `<p class="hata">${kacir(durum.alanHatalari.genel)}</p>` : ""}
    `;

    kutu.querySelectorAll("[data-hizmet]").forEach((b) =>
      b.addEventListener("click", () => { durum.hizmet = b.dataset.hizmet; ciz(); }));

    kutu.querySelectorAll("[data-iso]").forEach((b) =>
      b.addEventListener("click", () => {
        durum.slot = durum.slotlar.find((s) => s.iso === b.dataset.iso) ?? null;
        durum.alanHatalari = {};
        ciz();
      }));

    kutu.querySelector(".dahaFazla")?.addEventListener("click", () => { durum.genisGun += 7; ciz(); });

    /* Yazarken durum güncelleniyor ama YENİDEN ÇİZİLMİYOR: her tuşta çizmek
       imleci alanın sonuna atar. Bu, elle yazılan widget'ların klasik kusuru. */
    kutu.querySelector("#rw-ad")?.addEventListener("input", (e) => { durum.ad = e.target.value; });
    kutu.querySelector("#rw-iletisim")?.addEventListener("input", (e) => { durum.iletisim = e.target.value; });

    kutu.querySelector(".gonder")?.addEventListener("click", gonder);
  }

  async function saatleriGetir() {
    durum.yukleniyor = true;
    durum.hata = "";
    ciz();
    const simdi = Date.now();
    try {
      const dolu = await adaptor.dolu(simdi, simdi + 21 * 86400000);
      durum.slotlar = bosSlotlar({
        calisma,
        dolu: Array.isArray(dolu) ? dolu : [],
        simdi,
        gun: ayar.gun ?? 14,
        enErkenDk: ayar.enErkenDakika ?? 60,
        kapaliGunler: ayar.kapaliGunler ?? [],
      });
    } catch {
      /* Takvim okunamıyorsa saat GÖSTERİLMEZ. Boş listeyi "her saat müsait"
         diye çizmek, dolu bir saate randevu almak demektir. */
      durum.slotlar = [];
      durum.hata = metin.hataTakvim;
    }
    durum.yukleniyor = false;
    ciz();
  }

  async function gonder() {
    durum.alanHatalari = {};
    if (!durum.slot) durum.alanHatalari.genel = metin.saat;
    if (!durum.ad.trim()) durum.alanHatalari.ad = metin.zorunlu;
    if (!gecerliIletisim(durum.iletisim)) durum.alanHatalari.iletisim = metin.gecersizIletisim;
    if (Object.keys(durum.alanHatalari).length) { ciz(); return; }

    durum.gonderiliyor = true;
    ciz();
    let sonuc;
    try {
      sonuc = await adaptor.yaz({
        iso: durum.slot.iso,
        epoch: durum.slot.epoch,
        saatDilimi: calisma.saatDilimi,
        dakika: calisma.slotDakika ?? 30,
        ad: durum.ad.trim(),
        iletisim: durum.iletisim.trim(),
        hizmet: durum.hizmet,
      });
    } catch {
      sonuc = { ok: false };
    }
    durum.gonderiliyor = false;

    /* "Randevunuz oluşturuldu" cümlesi ancak adaptör ok dediğinde kurulur.
       Yazılamadığı hâlde onay göstermek, bu ürünün yapabileceği en kötü şey:
       kişi gelir, kaydı yoktur. */
    if (sonuc?.ok) {
      const g = gunlereBol([durum.slot], calisma.saatDilimi, ayar.dil ?? "tr-TR")[0];
      durum.tamam = { etiket: `${g.etiket}, ${durum.slot.saat}`, hizmet: durum.hizmet };
      hedef.dispatchEvent(new CustomEvent("randevu:olustu", { detail: { ...durum.slot, ad: durum.ad }, bubbles: true }));
    } else {
      durum.alanHatalari.genel = sonuc?.sebep || metin.hataYazma;
      /* Saat dolduysa liste tazelenir; eski liste tekrar aynı hatayı verir. */
      await saatleriGetir();
      return;
    }
    ciz();
  }

  ciz();
  void saatleriGetir();

  return {
    yenile: saatleriGetir,
    yokEt: () => { golge.innerHTML = ""; },
  };
}

function kacir(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
