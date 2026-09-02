/**
 * Slot aritmetiği. Saf fonksiyonlar, DOM yok, ağ yok.
 *
 * Ayrı dosyada olmasının sebebi: bu widget'ın en kolay bozulan yeri arayüz
 * değil, ZAMAN. Saf tutulunca tarayıcısız test edilebiliyor.
 *
 * ── Bilinmesi gereken tek şey ────────────────────────────────────────────────
 * Duvar saati İŞLETMENİN saatidir, ziyaretçinin değil.
 *
 * `new Date("2026-09-10T14:00")` ziyaretçinin tarayıcısında Berlin, sunucuda
 * UTC okunur. İkisi de yanlış cevap verir ve hata "randevu bir saat kaymış"
 * diye ortaya çıkar; yani ilk şikayete kadar görünmez. Bu yüzden burada hiçbir
 * yerde tarayıcının yerel saati kullanılmıyor: her dönüşüm işletmenin IANA
 * saat dilimiyle, `Intl.DateTimeFormat` üzerinden yapılıyor.
 */

/** Bir anın, verilen saat diliminde parçaları. */
export function parcalar(tarih, saatDilimi) {
  const b = new Intl.DateTimeFormat("en-CA", {
    timeZone: saatDilimi,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(tarih);
  const al = (t) => Number(b.find((p) => p.type === t)?.value ?? 0);
  return { yil: al("year"), ay: al("month"), gun: al("day"), saat: al("hour"), dakika: al("minute"), saniye: al("second") };
}

/**
 * Bir saat diliminin o andaki UTC farkı (dakika).
 * Yaz saati uygulaması yüzünden SABİT DEĞİLDİR; her an için ayrı hesaplanır.
 */
export function fark(tarih, saatDilimi) {
  const p = parcalar(tarih, saatDilimi);
  const yerelUTC = Date.UTC(p.yil, p.ay - 1, p.gun, p.saat, p.dakika, p.saniye);
  return (yerelUTC - Math.floor(tarih.getTime() / 1000) * 1000) / 60000;
}

/**
 * İşletmenin duvar saatini gerçek bir ana (epoch ms) çevirir.
 *
 * İki geçiş var ve ikincisi şart: ilk tahminle bulunan fark, yaz saati
 * geçişinin yanlış tarafında olabilir. İkinci geçiş o günü düzeltir.
 */
export function duvardanEpoch(saatDilimi, yil, ay, gun, saat, dakika) {
  const tahmin = Date.UTC(yil, ay - 1, gun, saat, dakika);
  const f1 = fark(new Date(tahmin), saatDilimi);
  const aday = tahmin - f1 * 60000;
  const f2 = fark(new Date(aday), saatDilimi);
  return f2 === f1 ? aday : tahmin - f2 * 60000;
}

/** "YYYY-MM-DDTHH:MM" dizesini çözer. Biçim tutmuyorsa null. */
export function isoCoz(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(iso ?? ""));
  if (!m) return null;
  return { yil: +m[1], ay: +m[2], gun: +m[3], saat: +m[4], dakika: +m[5] };
}

const GUN_ANAHTARLARI = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Bir anın işletme saat diliminde hangi güne denk geldiği. */
export function gunAnahtari(epoch, saatDilimi) {
  const kisa = new Intl.DateTimeFormat("en-US", { timeZone: saatDilimi, weekday: "short" })
    .format(new Date(epoch)).toLowerCase();
  return GUN_ANAHTARLARI.find((g) => kisa.startsWith(g)) ?? "mon";
}

const iki = (n) => String(n).padStart(2, "0");

/**
 * Boş slotları üretir.
 *
 * @param {object} a
 * @param {object} a.calisma  { saatDilimi, acilis:"09:00", kapanis:"18:00", acikGunler:["mon",...], slotDakika:30 }
 * @param {Array}  a.dolu     [{ bas, bit }] epoch ms
 * @param {number} a.simdi    epoch ms
 * @param {number} a.gun      kaç gün ileriye bakılacak
 * @param {number} a.enErkenDk  şu andan itibaren en erken kaç dakika sonrası verilebilir
 * @param {string[]} a.kapaliGunler  ["2026-09-15"] gibi tek tek kapalı tarihler
 */
export function bosSlotlar({ calisma, dolu = [], simdi = Date.now(), gun = 14, enErkenDk = 60, kapaliGunler = [] }) {
  const tz = calisma.saatDilimi;
  const [ah, am] = String(calisma.acilis || "09:00").split(":").map(Number);
  const [kh, km] = String(calisma.kapanis || "18:00").split(":").map(Number);
  const adim = Number(calisma.slotDakika) > 0 ? Number(calisma.slotDakika) : 30;
  const acik = new Set(calisma.acikGunler ?? ["mon", "tue", "wed", "thu", "fri"]);
  const kapali = new Set(kapaliGunler);
  const enErken = simdi + enErkenDk * 60000;

  const cikti = [];
  const bugun = parcalar(new Date(simdi), tz);
  const temel = Date.UTC(bugun.yil, bugun.ay - 1, bugun.gun);

  for (let d = 0; d < gun; d++) {
    const g = new Date(temel + d * 86400000);
    const yil = g.getUTCFullYear(), ay = g.getUTCMonth() + 1, ayGun = g.getUTCDate();
    const tarih = `${yil}-${iki(ay)}-${iki(ayGun)}`;
    if (kapali.has(tarih)) continue;

    const gunBas = duvardanEpoch(tz, yil, ay, ayGun, ah, am);
    if (!acik.has(gunAnahtari(gunBas, tz))) continue;

    const gunBit = duvardanEpoch(tz, yil, ay, ayGun, kh, km);
    for (let t = gunBas; t + adim * 60000 <= gunBit; t += adim * 60000) {
      if (t < enErken) continue;
      const bit = t + adim * 60000;
      if (dolu.some((b) => t < b.bit && b.bas < bit)) continue;
      const p = parcalar(new Date(t), tz);
      cikti.push({
        iso: `${tarih}T${iki(p.saat)}:${iki(p.dakika)}`,
        epoch: t,
        tarih,
        saat: `${iki(p.saat)}:${iki(p.dakika)}`,
      });
    }
  }
  return cikti;
}

/** Slotları güne göre gruplar; arayüz gün gün çiziyor. */
export function gunlereBol(slotlar, saatDilimi, dil = "tr-TR") {
  const bicim = new Intl.DateTimeFormat(dil, { timeZone: saatDilimi, weekday: "long", day: "numeric", month: "long" });
  const harita = new Map();
  for (const s of slotlar) {
    if (!harita.has(s.tarih)) harita.set(s.tarih, { tarih: s.tarih, etiket: bicim.format(new Date(s.epoch)), slotlar: [] });
    harita.get(s.tarih).slotlar.push(s);
  }
  return [...harita.values()];
}
