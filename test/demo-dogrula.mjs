/* Widget gerçekten çalışıyor mu — tarayıcıda, uçtan uca.
 *
 *   node test/demo-dogrula.mjs
 *
 * `node --test` slot aritmetiğini ölçüyor; bu betik arayüzü ölçüyor.
 * İkisi ayrı sorular: aritmetik doğru olup arayüz hiç çizilmemiş olabilir.
 *
 * Aranan sessiz kusurlar:
 *   · Shadow DOM sınırı tutuyor mu (sayfanın saldırgan CSS'i sızıyor mu)
 *   · saat seçilmeden gönderilebiliyor mu
 *   · yazma başarısızken "randevunuz oluşturuldu" deniyor mu
 *   · yazılan saat listeden düşüyor mu
 */

import puppeteer from "puppeteer-core";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

/* Kucuk bir yerel sunucu. `file://` uzerinden ES modulu yuklenmiyor (tarayici
   modul isteklerini CORS'a tabi tutuyor ve file:// kaynagi "null" sayiliyor),
   yani widget hic monte olmuyordu. Gercek kullanim da zaten http uzerinden. */
const TIP = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const sunucu = createServer(async (istek, cevap) => {
  /* Favicon istegi 404 uretip konsolu kirletiyordu ve o gurultu gercek bir
     hatayi gizleyebilir. Sessizce bos donuluyor. */
  if (istek.url === "/favicon.ico") { cevap.writeHead(204).end(); return; }
  const yol = normalize(decodeURI(istek.url.split("?")[0])).replace(/^([.]{2}[/\\])+/, "");
  const dosya = join(process.cwd(), yol === "/" ? "demo/index.html" : yol);
  try {
    const govde = await readFile(dosya);
    cevap.writeHead(200, { "Content-Type": TIP[extname(dosya)] ?? "application/octet-stream" });
    cevap.end(govde);
  } catch {
    cevap.writeHead(404).end("yok");
  }
});
await new Promise((r) => sunucu.listen(4173, r));

const CHROME =
  process.env.CHROME_PATH ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: process.env.CI ? ["--no-sandbox"] : [] });
const sayfa = await browser.newPage();
await sayfa.setViewport({ width: 1200, height: 900 });

const hatalar = [];
sayfa.on("pageerror", (e) => hatalar.push(String(e)));
sayfa.on("console", (m) => { if (m.type() === "error") hatalar.push(m.text()); });

await sayfa.goto("http://localhost:4173/demo/index.html", { waitUntil: "load" });
await new Promise((r) => setTimeout(r, 900));

let gecen = 0, kalan = 0;
const yaz = (ad, ok, not = "") => {
  if (ok) { gecen++; console.log(`  OK   ${ad}${not ? " - " + not : ""}`); }
  else { kalan++; console.log(`  HATA ${ad}${not ? " - " + not : ""}`); }
};

const golge = async (fn, ...arg) =>
  sayfa.evaluate((kod, ...a) => {
    const k = document.getElementById("randevu").shadowRoot;
    // eslint-disable-next-line no-new-func
    return new Function("golge", ...a.map((_, i) => `a${i}`), kod)(k, ...a);
  }, fn, ...arg);

const ilk = await golge(`
  const slot = golge.querySelector(".slot");
  const s = slot && getComputedStyle(slot);
  return {
    slotSayisi: golge.querySelectorAll(".slot").length,
    hizmetSayisi: golge.querySelectorAll("[data-hizmet]").length,
    girdiSayisi: golge.querySelectorAll("input").length,
    slotRengi: s && s.backgroundColor,
    slotYazi: s && s.fontFamily,
    inputCerceve: golge.querySelector("input") && getComputedStyle(golge.querySelector("input")).borderColor,
  };
`);

yaz("widget çizildi", ilk.slotSayisi > 0, `${ilk.slotSayisi} slot`);
yaz("hizmet seçenekleri var", ilk.hizmetSayisi === 3, `${ilk.hizmetSayisi}`);
yaz("ad ve iletişim alanı var", ilk.girdiSayisi === 2, `${ilk.girdiSayisi}`);
/* Sayfa `button { background: red !important }` diyor. Sizarsa slotlar kirmizi olur. */
yaz("sayfanın kırmızı buton kuralı sızmadı", !/rgb\(255,\s*0,\s*0\)/.test(ilk.slotRengi ?? ""), ilk.slotRengi);
yaz("sayfanın Comic Sans kuralı sızmadı", !/comic/i.test(ilk.slotYazi ?? ""), (ilk.slotYazi ?? "").slice(0, 40));
yaz("sayfanın macenta input kuralı sızmadı", !/rgb\(255,\s*0,\s*255\)/.test(ilk.inputCerceve ?? ""), ilk.inputCerceve);

/* Saat secilmeden gonderim: uc alan da hata vermeli, randevu OLUSMAMALI. */
const bosGonderim = await golge(`
  golge.querySelector(".gonder").click();
  return new Promise((r) => setTimeout(() => r({
    hata: golge.querySelectorAll(".hata").length,
    basarili: !!golge.querySelector(".basarili"),
  }), 250));
`);
yaz("saat seçilmeden gönderilemiyor", !bosGonderim.basarili && bosGonderim.hata >= 2,
    `${bosGonderim.hata} hata`);

/* Dogru akis: saat sec, ad yaz, telefon yaz, gonder. */
const tamAkis = await golge(`
  golge.querySelector(".slot").click();
  return new Promise((r) => setTimeout(() => {
    const secili = golge.querySelector('.slot[aria-pressed="true"]');
    r({ secildi: !!secili, saat: secili && secili.textContent.trim() });
  }, 150));
`);
yaz("saat seçilebiliyor", tamAkis.secildi, tamAkis.saat);

const gonderim = await golge(`
  golge.querySelector("#rw-ad").value = "Test Kisi";
  golge.querySelector("#rw-ad").dispatchEvent(new Event("input", { bubbles: true }));
  golge.querySelector("#rw-iletisim").value = "05001112233";
  golge.querySelector("#rw-iletisim").dispatchEvent(new Event("input", { bubbles: true }));
  golge.querySelector(".gonder").click();
  return new Promise((r) => setTimeout(() => r({
    basarili: !!golge.querySelector(".basarili"),
    metin: (golge.querySelector(".basarili") || {}).textContent || "",
  }), 900));
`);
yaz("randevu oluşturuldu", gonderim.basarili, gonderim.metin.replace(/\s+/g, " ").slice(0, 60));

const olay = await sayfa.evaluate(() => document.getElementById("kayit").textContent);
yaz("randevu:olustu olayı yayıldı", olay.includes("randevu:olustu"), olay.split("\n")[1]?.trim() ?? "");

/* ── Kötü günler: adaptör bozuk, belirsiz ya da yavaş cevap verirse ─────────────
   Her senaryo aynı sayfada, kendi adaptörüyle ayrı bir widget kurar. */
await sayfa.evaluate(() => {
  const bekle = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__kur = async (adaptor) => {
    const { randevuWidget } = await import("/src/randevu-widget.js");
    const el = document.createElement("div");
    document.body.appendChild(el);
    randevuWidget(el, {
      isletme: "Test",
      calisma: { saatDilimi: "Europe/Istanbul", acilis: "09:00", kapanis: "18:00",
                 acikGunler: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], slotDakika: 30 },
      adaptor,
    });
    await bekle(150);
    return el.shadowRoot;
  };
  window.__doldur = (g) => {
    for (const [id, v] of [["#rw-ad", "Test Kisi"], ["#rw-iletisim", "05001112233"]]) {
      g.querySelector(id).value = v;
      g.querySelector(id).dispatchEvent(new Event("input", { bubbles: true }));
    }
  };
  window.__bekle = bekle;
});

/* Takvim hata nesnesi döndürürse boş takvim sayılmamalı: dolu saatler müsait görünür. */
const bozukTakvim = await sayfa.evaluate(async () => {
  const sonuc = [];
  for (const cevap of [{ hata: "yetki yok" }, [{ bas: "dun", bit: 5 }], null]) {
    const g = await window.__kur({ dolu: async () => cevap, yaz: async () => ({ ok: true }) });
    sonuc.push({ slot: g.querySelectorAll(".slot").length, hata: !!g.querySelector(".hata") });
  }
  return sonuc;
});
yaz("bozuk takvim yanıtında saat gösterilmiyor",
    bozukTakvim.every((s) => s.slot === 0 && s.hata), JSON.stringify(bozukTakvim));

/* Adaptör "ok": "false" gibi belirsiz bir şey dönerse onay ekranı çıkmamalı. */
const belirsiz = await sayfa.evaluate(async () => {
  const g = await window.__kur({ dolu: async () => [], yaz: async () => ({ ok: "false" }) });
  g.querySelector(".slot").click();
  window.__doldur(g);
  g.querySelector(".gonder").click();
  await window.__bekle(300);
  return { basarili: !!g.querySelector(".basarili"), hata: !!g.querySelector(".hata") };
});
yaz("belirsiz cevapta onay gösterilmiyor", !belirsiz.basarili && belirsiz.hata, JSON.stringify(belirsiz));

/* Yazma "saat doldu" derse: onay yok, hata var, o saat listeden düşmüş ve seçim kalkmış. */
const doldu = await sayfa.evaluate(async () => {
  const defter = [];
  const g = await window.__kur({
    dolu: async () => defter.slice(),
    yaz: async (r) => { defter.push({ bas: r.epoch, bit: r.epoch + 1800000 }); return { ok: false, sebep: "O saat az önce doldu." }; },
  });
  const ilk = g.querySelector(".slot");
  const epoch = ilk.dataset.epoch;
  ilk.click();
  window.__doldur(g);
  g.querySelector(".gonder").click();
  await window.__bekle(400);
  return {
    basarili: !!g.querySelector(".basarili"),
    hata: [...g.querySelectorAll(".hata")].map((h) => h.textContent).join(" "),
    halaListede: !!g.querySelector(`.slot[data-epoch="${epoch}"]`),
    seciliVar: !!g.querySelector('.slot[aria-pressed="true"]'),
  };
});
yaz("dolan saat listeden düşüyor, seçim kalkıyor",
    !doldu.basarili && /doldu/.test(doldu.hata) && !doldu.halaListede && !doldu.seciliVar, JSON.stringify(doldu));

/* Gönderim sürerken başka saate tıklanırsa: yazılan ve onayda görünen saat ilk seçilen kalmalı. */
const yaris = await sayfa.evaluate(async () => {
  let yazilan = null;
  const g = await window.__kur({
    dolu: async () => [],
    yaz: async (r) => { yazilan = r.epoch; await window.__bekle(300); return { ok: true }; },
  });
  const [birinci, ikinci] = g.querySelectorAll(".slot");
  const beklenen = { epoch: Number(birinci.dataset.epoch), saat: birinci.textContent.trim() };
  birinci.click();
  window.__doldur(g);
  g.querySelector(".gonder").click();
  await window.__bekle(50);
  g.querySelectorAll(".slot")[1]?.click();
  await window.__bekle(450);
  const onay = (g.querySelector(".basarili") || {}).textContent || "";
  return { yazilanDogru: yazilan === beklenen.epoch, onayDogru: onay.includes(beklenen.saat), ikinci: ikinci.textContent.trim(), onay: onay.replace(/\s+/g, " ").trim() };
});
yaz("gönderim sürerken saat değişmiyor", yaris.yazilanDogru && yaris.onayDogru, yaris.onay);

yaz("konsolda hata yok", hatalar.length === 0, hatalar.slice(0, 2).join(" | "));

await browser.close();
sunucu.close();
console.log(`\nSONUC: ${gecen} gecti, ${kalan} kaldi\n`);
process.exit(kalan ? 1 : 0);
