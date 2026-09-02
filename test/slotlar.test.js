/* Slot aritmetiğinin testi. Tarayıcı yok, bağımlılık yok.
 *
 *   node --test
 *
 * Buradaki vakaların çoğu bir kusurun karşılığı. Randevu widget'ı yazan
 * herkesin er geç göreceği hatalar bunlar ve hepsi sessizdir: hiçbiri konsola
 * bir şey yazmaz, yalnızca hasta yanlış saatte gelir.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { bosSlotlar, duvardanEpoch, gunAnahtari, gunlereBol, isoCoz, parcalar } from "../src/slotlar.js";

const IST = "Europe/Istanbul";
const LON = "Europe/London";

/* 10 Eylül 2026, Perşembe. */
const CALISMA = {
  saatDilimi: IST,
  acilis: "09:00",
  kapanis: "12:00",
  acikGunler: ["mon", "tue", "wed", "thu", "fri"],
  slotDakika: 30,
};

const PERSEMBE_08 = duvardanEpoch(IST, 2026, 9, 10, 8, 0);

test("duvar saati işletmenin saat dilimiyle çözülür, tarayıcının değil", () => {
  const ist = duvardanEpoch(IST, 2026, 9, 10, 14, 0);
  const lon = duvardanEpoch(LON, 2026, 9, 10, 14, 0);
  /* Aynı duvar saati, farklı iki şehirde farklı iki andır. Eşit çıkıyorsa
     kod tarayıcının yerel saatini kullanıyor demektir. */
  assert.notEqual(ist, lon);
  assert.equal((lon - ist) / 3600000, 2);
});

test("yaz saati geçişinde saat kaymaz", () => {
  /* Londra 25 Ekim 2026'da yaz saatinden çıkıyor. Geçişin iki yanındaki
     09:00'lar aynı UTC farkına sahip DEĞİLDİR; tek geçişli bir hesap burada
     bir saat kayar. */
  const once = duvardanEpoch(LON, 2026, 10, 24, 9, 0);
  const sonra = duvardanEpoch(LON, 2026, 10, 26, 9, 0);
  assert.equal(parcalar(new Date(once), LON).saat, 9);
  assert.equal(parcalar(new Date(sonra), LON).saat, 9);
  /* İki gün ara var ama saat farkı yüzünden 48 saat DEĞİL. */
  assert.equal((sonra - once) / 3600000, 49);
});

test("gün adı işletmenin saat diliminde hesaplanır", () => {
  const cuma0030 = duvardanEpoch(IST, 2026, 9, 11, 0, 30);
  assert.equal(gunAnahtari(cuma0030, IST), "fri");
  /* Aynı an Londra'da hâlâ perşembe. Gün adını yerel saatle hesaplayan kod
     kapalı bir güne randevu yazar. */
  assert.equal(gunAnahtari(cuma0030, LON), "thu");
});

test("mesai içinde doğru sayıda slot üretilir", () => {
  const s = bosSlotlar({ calisma: CALISMA, simdi: PERSEMBE_08, gun: 1, enErkenDk: 0 });
  /* 09:00-12:00, 30 dakikalık slot: 09:00 09:30 10:00 10:30 11:00 11:30 */
  assert.equal(s.length, 6);
  assert.equal(s[0].saat, "09:00");
  assert.equal(s.at(-1).saat, "11:30");
});

test("kapanış saatine taşan slot üretilmez", () => {
  const s = bosSlotlar({
    calisma: { ...CALISMA, kapanis: "12:00", slotDakika: 45 },
    simdi: PERSEMBE_08, gun: 1, enErkenDk: 0,
  });
  /* 09:00 09:45 10:30 11:15. 12:00'de biten bir slot daha yok. */
  assert.deepEqual(s.map((x) => x.saat), ["09:00", "09:45", "10:30", "11:15"]);
});

test("dolu aralık slotu düşürür, kısmi çakışma dahil", () => {
  const dolu = [{
    bas: duvardanEpoch(IST, 2026, 9, 10, 9, 15),
    bit: duvardanEpoch(IST, 2026, 9, 10, 9, 45),
  }];
  const s = bosSlotlar({ calisma: CALISMA, dolu, simdi: PERSEMBE_08, gun: 1, enErkenDk: 0 });
  /* 09:00 ve 09:30 slotlarının ikisi de o aralığa değiyor. */
  assert.deepEqual(s.map((x) => x.saat), ["10:00", "10:30", "11:00", "11:30"]);
});

test("çok yakın saat verilmez", () => {
  const s = bosSlotlar({ calisma: CALISMA, simdi: duvardanEpoch(IST, 2026, 9, 10, 9, 50), gun: 1, enErkenDk: 60 });
  assert.equal(s[0].saat, "11:00");
});

test("kapalı gün atlanır", () => {
  const s = bosSlotlar({
    calisma: { ...CALISMA, acikGunler: ["mon"] },
    simdi: PERSEMBE_08, gun: 3, enErkenDk: 0,
  });
  assert.equal(s.length, 0, "persembe-cumartesi arasi pazartesi yok");
});

test("tek tek kapalı tarihler atlanır", () => {
  const s = bosSlotlar({
    calisma: CALISMA, simdi: PERSEMBE_08, gun: 2, enErkenDk: 0,
    kapaliGunler: ["2026-09-10"],
  });
  assert.ok(s.every((x) => x.tarih !== "2026-09-10"));
  assert.ok(s.some((x) => x.tarih === "2026-09-11"));
});

test("iso dizesi çözülür, bozuk biçim null döner", () => {
  assert.deepEqual(isoCoz("2026-09-10T14:30"), { yil: 2026, ay: 9, gun: 10, saat: 14, dakika: 30 });
  for (const kotu of ["2026-09-10", "10.09.2026 14:30", "", null, "2026-9-10T14:30"]) {
    assert.equal(isoCoz(kotu), null, String(kotu));
  }
});

test("günlere bölme işletmenin diliyle etiketler", () => {
  const s = bosSlotlar({ calisma: CALISMA, simdi: PERSEMBE_08, gun: 2, enErkenDk: 0 });
  const gunler = gunlereBol(s, IST, "tr-TR");
  assert.equal(gunler.length, 2);
  assert.match(gunler[0].etiket, /Perşembe/);
  assert.equal(gunler[0].slotlar.length, 6);
});

test("slot iso dizesi işletmenin duvar saatini taşır", () => {
  const s = bosSlotlar({ calisma: CALISMA, simdi: PERSEMBE_08, gun: 1, enErkenDk: 0 });
  assert.equal(s[0].iso, "2026-09-10T09:00");
  /* iso ile epoch aynı anı göstermeli; ayrışırlarsa sunucu başka saate yazar. */
  const c = isoCoz(s[0].iso);
  assert.equal(duvardanEpoch(IST, c.yil, c.ay, c.gun, c.saat, c.dakika), s[0].epoch);
});
