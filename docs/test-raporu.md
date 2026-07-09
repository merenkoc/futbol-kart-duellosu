# Test Raporu — Futbol Kart Düellosu (canlıya hazırlık)

Tarih: 2026-07-06. Amaç: projenin sağlıklı canlıya alınabilmesi için tüm otomatik
testleri ve tip kontrolünü çalıştırmak, sonucun ne anlama geldiğini açıklamak.

## Özet sonuç

| Kontrol | Sonuç |
|---|---|
| Server birim + entegrasyon testleri (Vitest) | **89 / 89 geçti** (11 dosya) |
| Client reducer testleri (Vitest) | **3 / 3 geçti** |
| `tsc --noEmit` — server | **temiz (0 hata)** |
| `tsc --noEmit` — client | **temiz (0 hata)** |

Kısacası: motor, oturum/soket katmanı ve client durum makinesi (reducer) yeşil;
tip sistemi de tutarlı. Faz 2'nin kabul kriteri ("bota karşı tam bir maç") ve
Faz 3/4'te eklenen dayanıklılık düzeltmeleri (K1/K2/Y1) testlerle korunuyor.

## Hangi test neyi güvenceye alıyor (ne neye etki eder)

- **scoring.test (17):** Görev formülü `Σ(stat×ağırlık)/Σ(ağırlık)`. Bozulursa
  her turun kazananı yanlış hesaplanır — oyunun kalbi. En kritik koruma.
- **draft.test (14):** Kademe kompozisyonu seçimi, kademe tükenince en yakına
  düşme, "kendi elinde kopya yasak / rakiple kopya serbest" kuralı. Bozulursa
  draft dengesi ve kart dağıtımı bozulur.
- **match.test (12):** 5 turluk maç akışı, Kilit Round (kaleci turu), skor
  tablosu, beraberlikte penaltıya düşme.
- **penalty.test (13):** Atıcı gücü (sut×0.7+teknik×0.3), kurtarış, ani ölüm,
  eşitlikte stat toplamı → yazı-tura son çare.
- **session.penalty.test (4):** `MatchSession` kabuğunun penaltı fazını doğru
  yürütmesi + **K1 regresyonu**: Kilit Round sonrası kalecinin id'si atıcı
  listesine sızmamalı (senin yaşadığın "atıcı seçildi, öyle kaldı" kilitlenmesinin
  kök nedeni). Bu test o hatanın geri gelmesini engelliyor.
- **handlers.payload.test (1):** **K2 regresyonu** — bozuk/eksik soket payload'ı
  (ör. `room:join` payloadsız) sunucuyu düşürmemeli. Tek bozuk client'ın tüm
  in-memory maçları çökertmesini engeller.
- **handlers.bot-defensive.test (1):** **Y1** — bot zamanlayıcısındaki bir hata
  `setTimeout` içinde süreci öldürmemeli; sunucu ayakta kalmalı (~12 sn sürer,
  gerçek gecikmeli bot akışını beklediği için normal).
- **lobby.test (5):** Oda/kuyruk eşleştirme + **O2** (aynı socket kuyrukta bir
  kez durur) invariant'ı.
- **store.test (5):** socket↔oyuncu eşleşmesi, reconnect rebind, entry silme.
- **data.test (11):** `cards.json`/`tasks.json`/`config.json` şema ve değer
  doğrulaması. "Veri kodu bozmasın" güvencesi.
- **reducer.test (client, 3):** Penaltı ani ölümde client'ın kilitlenmemesi
  (Sorun 2), state geçişleri.

## Notlar ve canlı öncesi kalan işler (sağlık raporundan)

Kod düzeltmeleri K1, K2, Y1 zaten uygulanmış ve şimdi regresyon testleriyle
sabitlenmiş durumda. Kalanlar (bloke edici değil):

- **O1:** Bot maçında sayfa yenilenince kısa "Maç bulunamadı" banner'ı. Çözüm
  App.tsx'te zaten uygulanmış görünüyor (bot maçında localStorage'a yazılmıyor).
- **N1:** Deploy'da (Faz 5) `CLIENT_ORIGIN` env'inin doğru origin'e ayarlanması.
- **N2:** Bot penaltıda hep en güçlü atıcıyı seçiyor (denge önerisi, bug değil).

## Nasıl çalıştırıldı (tekrar üretmek için)

```bash
npm install
npm test                         # server 89 + client 3
npm run typecheck -w @fkd/server
npm run typecheck -w @fkd/client
```
