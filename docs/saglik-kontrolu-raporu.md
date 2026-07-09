# Sağlık Kontrolü Raporu — Futbol Kart Düellosu (Faz 4 sonu)

Yöntem: kod statik incelemesi + sunucu izole bir ortamda ayağa kaldırılıp socket.io-client
ile programatik uçtan uca testler (bot maçları, friend maçı, zorunlu penaltı, ani ölüm,
reconnect, kötü-payload DoS taraması). Tüm bulgular çalışan sistemde doğrulandı.

**Test durumu:** server 85 test + client 3 test yeşil, her iki workspace `tsc` temiz.
Uçtan uca: 3 paralel bot maçı, friend maçı (iki client aynı sonucu gördü), 6 zorunlu-penaltı
maçı sorunsuz aktı.

---

## 🔴 KRİTİK

### K1 — Kaleci penaltıda "atıcı" olarak listeleniyor → bot çöküyor / oyun kilitleniyor
**Muhtemelen senin gördüğün "atıcıyı seçtim, rakip bekleniyor, öyle kaldı" hatasının kök nedeni.**

`session.availableShooterIds()` maçta kullanılmış kart id'lerini döndürüyor. Ama Kilit
Round'da kaleci de `matchState.usedCardIds`'e ekleniyor (motorda `resolveRound` oynanan kartı
"kullanıldı" işaretler, kaleci turu dahil). Sonuç: **kalecinin id'si atıcı listesine sızıyor.**

- **Client'ta** kazara maskeleniyor: `Penalty.tsx` adayları `hand.fieldCards.filter(...)` ile
  süzdüğü için kaleci ekranda görünmüyor. Bu yüzden insan oyuncu fark etmiyor.
- **Bot'ta maskelenmiyor:** `botShooterChoice()` id'yi doğrudan `hand.fieldCards.find(...)`
  ile eşliyor; kaleci id'si saha kartları arasında bulunamıyor → `undefined` → `shooterPower`
  içinde `Cannot read properties of undefined`. `setTimeout` içindeki bu hata bot'un seçimini
  hiç yaptırmıyor; oyuncu tarafında sonsuz "rakip bekleniyor".

Kanıt: sandbox'ta bot penaltıya girer girmez `server.log`'da
`TypeError ... at shooterPower ... at botPenaltyPick` ile süreç düştü.

**Çözüm (doğrulandı):** `availableShooterIds` yalnızca saha kartı id'lerini döndürsün:
```ts
availableShooterIds(playerIdx: 0 | 1): string[] {
  const fieldIds = new Set(this.hands![playerIdx].fieldCards.map((c) => c.id));
  const usedInMatch = this.matchState!.usedCardIds[playerIdx];
  const usedAsShooter = this.penaltyState!.usedShooterIds[playerIdx];
  return usedInMatch.filter((id) => fieldIds.has(id) && !usedAsShooter.includes(id));
}
```
Bu fix'le 6/6 zorunlu-penaltı maçı temiz bitti ve kaleci hiçbir listede görünmedi.
**Regresyon testi eklenmeli:** Kilit Round sonrası `availableShooterIds` kaleci id'sini
içermemeli.

### K2 — Socket payload doğrulaması yok → tek kullanıcı tüm sunucuyu çökertebilir
Handler'lar payload'ı doğrudan destructure ediyor: `socket.on('room:join', ({ roomId }) => ...)`.
`socket.emit('room:join')` (payload'sız) gelince `Cannot destructure property 'roomId' of
'undefined'` fırlıyor. Bu, bir socket event handler'ında yakalanmadığı için **tüm Node
sürecini düşürüyor** — o an oynanan bütün maçlar (in-memory state) kayboluyor. Kötü niyet
gerekmez; eski/bozuk bir client bile tetikleyebilir.

Etkilenen event'ler: `room:join`, `match:reconnect`, `draft:pick`, `round:playCard`,
`penalty:pickShooter`.

**Çözüm (doğrulandı):** her handler'da alanı tip-kontrollü çöz (`typeof x?.field === 'string'
? ... : ''`), boş/yanlış değeri mevcut "geçersiz" dallarına düşür. Fix sonrası 7 bozuk payload
peş peşe atıldı, sunucu ayakta kaldı ve düzgün `error` event'leri döndü.

---

## 🟠 YÜKSEK

### Y1 — Bot zamanlayıcılarında try/catch yok
`scheduleBotDraftPick/RoundPick/ShooterPick` içindeki `setTimeout` callback'leri motor
fonksiyonlarını sarmalamadan çağırıyor. Motor beklenmedik bir durumda `throw` ederse (K1 bunun
canlı örneğiydi) hata `setTimeout` bağlamında yakalanmaz ve süreci öldürür. K1 düzeltilse de
bu bir savunma katmanı olarak kalmalı: üç bot callback'i de `try/catch` ile sarılıp hata
loglanmalı (fix sandbox'ta uygulandı ve doğrulandı).

---

## 🟡 ORTA

### O1 — Bot maçında reconnect yok ama client bunu bilmiyor
`disconnect` handler'ı `mode==='bot'` maçında entry'yi anında siliyor (tasarım gereği makul —
bot maçı geçici). Ama `App.tsx` her maçı (bot dahil) `localStorage`'a yazıp yeniden yüklemede
reconnect deniyor. Bot maçında sayfa yenilenince: sunucu "Maç bulunamadı" döndürüyor, kısa bir
hata banner'ı yanıp sönüyor, maç kayboluyor. Doğrulandı: friend reconnect **çalışıyor** (tur 1'e
düzgün resync oldu), bot reconnect beklendiği gibi reddediliyor.
**Öneri:** `match:start`'ta modu da sakla; bot modunda `localStorage`'a yazma veya yenilemede
reconnect'i atla. Küçük UX pürüzü, veri kaybı riski yok.

### O2 — Kuyruğa aynı socket birden çok kez girebilir
`lobby.joinQueue` kendini eşleştirmeyi (`waiting.id === socket.id`) engelliyor ama aynı socket
üst üste `queue:join` yollarsa kuyrukta birden çok kez durabilir. İstismar potansiyeli düşük,
ama matchmaking'de tuhaf eşleşmelere yol açabilir. Kuyruğa eklemeden önce "zaten kuyrukta mı"
kontrolü eklenebilir.

---

## 🟢 DÜŞÜK / NOT

- **N1:** `server.ts` CORS tek origin'e sabit, prod'da `CLIENT_ORIGIN` env ile. Faz 5 deploy'da
  doğru origin'in verildiğinden emin ol.
- **N2:** Bot penaltıda hep en güçlü atıcıyı seçtiği için testlerde insan tarafı sürekli
  kaybetti. Bu bir bug değil (tasarım), ama denge açısından penaltıda bot'a da %-lik rastgelelik
  düşünülebilir (tur seçimindeki gibi).
- **N3:** Mimari temiz: motor (`engine/`) saf ve Socket.io'dan bağımsız kalmış, gizli bilgi
  (rakip eli/seçenekleri) hiçbir emit'te sızmıyor — tasarım §12 güvenlik ilkesine uyulmuş.
  Sahne tempo katmanı (Sorun 1 fix'i) doğru kurgulanmış, `stillActive` guard'ı forfeit/rematch
  yarışlarını kapatıyor.

---

## Önerilen aksiyon sırası
1. **K1 + K2 hemen** (ikisi de birer commit; K1 senin yaşadığın kilitlenmeyi bitirir, K2 sunucu
   dayanıklılığı). Her ikisi için regresyon testi ekle.
2. **Y1** aynı PR'de (savunma katmanı).
3. **O1, O2** sonraki temizlik turunda.

Kritik iki fix'i sandbox'ta uygulayıp uçtan uca doğruladım; istersen bu iki düzeltmeyi
(+ testleri) doğrudan projeye uygularım, ya da Claude Code'da uygulaman için hazır bir
prompt/diff çıkarırım.
