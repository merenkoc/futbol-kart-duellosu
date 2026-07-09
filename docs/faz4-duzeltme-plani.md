# Faz 4 Düzeltme Planı — Tempo, Penaltı Kilitlenmesi, Kilit Round Sekansı, FUT Kart Tasarımı

Kullanıcı testinde bulunan 3 sorunun teşhisi ve onaylanmış çözüm planı.
Uygulamadan önce CLAUDE.md kurallarını hatırla: motor saf kalır, socket event isimleri değişmez, mevcut testler yeşil kalır.

---

## Sorun 1 — Sunucuda sahne temposu yok (kök neden: tüm reveal'ler görünmüyor)

**Teşhis:** `server/src/socket/handlers.ts` içinde tur çözümü tamamen senkron:
`afterRoundResolved()` → `round:reveal` + `match:score` emit eder ve **aynı tick'te** `startMatchRound()` → sonraki `round:task` gider. Client reducer'ında `ROUND_TASK` hem `screen: 'match'` yapar hem `lastReveal: null` sıfırlar. Sonuç:

- Kilit Round ekranı (`keeperRound:start` ile açılır) milisaniyeler içinde 4. turun `round:task`'ıyla eziliyor → kullanıcı kaleci turunu hiç göremiyor.
- Normal turlarda da kart karşılaştırma/sonuç alanı (reveal) anında siliniyor.
- Penaltıda `penalty:result` → hemen `penalty:start` veya `match:end` gidiyor; sonuç sahnesi görünmüyor.

**Çözüm — sahne gecikmeleri (sunucu tarafı):**

1. `shared/data/config.json`'a `timing` bölümü ekle (client animasyon süreleri de buradan okusun, tek kaynak):
```json
"timing": {
  "revealMs": 3000,        // saha turu reveal -> sonraki round:task
  "keeperIntroMs": 2500,   // keeperRound:start -> round:reveal (kartların giriş sekansı)
  "keeperRevealMs": 3500,  // kaleci reveal -> sonraki round:task (banner için pay)
  "penaltyResultMs": 3000  // penalty:result -> yeni penalty:start veya match:end
}
```
`GameConfig` tipine (`shared/src/types.ts`) ekle.

2. `handlers.ts`'te akışı `setTimeout` ile sırala. Her timer, bot zamanlayıcılarındaki guard desenini kullanmalı:
   `if (store.getEntry(session.id)?.session !== session || session.phase !== <beklenen>) return;`
   - Saha turu: reveal + score emit → `revealMs` sonra `startMatchRound()`.
   - Kilit Round: `keeperRound:start` emit → `keeperIntroMs` sonra reveal + score emit → `keeperRevealMs` sonra sonraki tur / faz geçişi.
     (Dikkat: bugün `playKeeperRoundAuto()` turu anında çözüyor — çözüm sunucuda hemen yapılabilir, sadece **emit'ler** geciktirilir.)
   - Penaltı: `penalty:result` emit → `penaltyResultMs` sonra `startPenaltyExchange()` veya `emitMatchEnd()`.
   - `match:end` (skorla biten maçta) son reveal'den `revealMs` sonra gitmeli.
3. Kopukluk/forfeit ile yarış: `forfeit()` `phase='finished'` yaptığı için guard'lar bekleyen timer'ları etkisiz kılar; yine de `store.deleteEntry` sonrası çalışan timer'ların crash etmediğini test et.
4. Reconnect resync (`resyncPlayer`) gecikme penceresinin ortasına düşebilir — mevcut davranış kabul edilebilir (bir sonraki event'te toparlanır), ama phase 'match' iken pending reveal varsa `round:task` yerine son reveal'i de göndermek artı puan.

---

## Sorun 2 — Penaltı ani ölümde kilitleniyor (oyun tamamen takılıyor)

**Teşhis:** İlk seri berabere biterse (ikisi de gol / ikisi de kaçırdı) sunucu yeni `penalty:start` gönderir. `client/src/reducer.ts`'te `PENALTY_START` önceki `lastResult`'ı **koruyor** (`lastResult: state.penalty?.lastResult ?? null`), `client/src/screens/Penalty.tsx` ise atıcı kartlarını yalnızca `!result` iken render ediyor. Sonuç: ikinci seride kart seçilemez, oyun sonsuza dek bekler. (Sorun 1'deki tempo eksiğini client'ta telafi etme girişiminin yan etkisi.)

**Çözüm:**
1. `PENALTY_START` artık `lastResult: null` yapsın (sonuç, Sorun 1'in `penaltyResultMs` gecikmesi sayesinde zaten ekranda kalmış olacak). `totalGoals` korunmaya devam etsin.
2. `Penalty.tsx`: seri sayacı göster ("Seri 2 — Ani Ölüm" gibi; `exchangeIndex` zaten payload'da var, reducer'da sakla). Ani ölümde başlık değişsin.
3. **Regresyon testi ekle:** reducer için `PENALTY_RESULT` → `PENALTY_START` dizisinden sonra `lastResult === null` ve seçim yapılabilir olduğunu doğrulayan birim test. Ayrıca server tarafında vitest fake timers ile: beraberlik → penaltı → berabere seri → yeni `penalty:start`'ın gittiğini doğrulayan entegrasyon testi (handlers seviyesinde mümkün değilse session seviyesinde).

---

## Sorun 3 — Kilit Round sahnesi: "Sekans + geçiş vurgusu" (kullanıcı seçimi)

`client/src/screens/KeeperRound.tsx` yeniden yazılacak. Hedef sekans (süreler `config.timing` ile uyumlu):

1. **t0 (`keeperRound:start`):** Sahne kararır (overlay), spot ışığı efekti. İki kaleci kartı yanlardan büyük boy (normal kartın ~1.3 katı) slide-in + hafif parlama. Ortada "KİLİT ROUND" başlığı ve görev adı dramatik biçimde belirir (scale+fade). Düdük sesi mevcut, kalsın.
2. **t0+keeperIntroMs (`round:reveal` geldiğinde):** İki kalecinin görev skorları bar olarak yarışırcasına dolar (0'dan skora, ~1 sn), kazanan kart altın parlamayla öne çıkar, kaybeden soluklaşır. Beraberlikte iki kart da mavi parlar.
3. **t0+intro+keeperRevealMs (`round:task` geldiğinde):** Maç ekranına dönüş + üstte 2-3 sn görünen sonuç banner'ı: "Kilit Round: Kalecin kazandı! (+3)" / "Rakip kaleci kazandı" / "Berabere (1-1)". Banner için reducer'da keeper sonucu sakla (`ROUND_TASK` geldiğinde `keeperBanner`'a taşı, timeout ile temizle).

Kaleci seçiminin değerini artıran ek dokunuş: draft'ın 3. turunda (kaleci turu) seçeneklerin üstüne "Bu kart Kilit Round'da otomatik oynar ve penaltıda kurtarış gücünü belirler" bilgi notu ekle.

---

## Sorun 4 — Kart görsel tasarımı: FIFA/FUT tarzı (kullanıcı seçimi)

`client/src/components/CardView.tsx` + `index.css` yeniden tasarlanacak:

- **Kademe çerçeveleri:** alt = bronz degrade, orta = gümüş degrade, üst = altın degrade (CSS gradient + iç çerçeve çizgisi). Kademe hesabı için `overall`/`tierOf` fonksiyonlarını `shared/src`'e taşı (örn. `shared/src/cards.ts`), server `engine/cards.ts` oradan re-export etsin — motor testleri değişmeden yeşil kalmalı. Client doğrudan shared'dan import eder.
- **Kart yüzü:** sol üstte büyük overall rozeti + altında pozisyon etiketi (SAHA/KALECİ), üst orta alanda isim (uzun isimler için font ölçekleme), altta statlar.
- **Statlar:** her stat için isim + değer + dolum barı (değer/99 genişlik, kademe rengiyle uyumlu). Kaleci kartında 3 stat daha geniş barlarla.
- **Boyut:** ~160×224 (mobilde 128×180). Seçili kart: yeşil glow; kullanılmış: gri + "OYNANDI" rozeti; kapalı kart (faceDown) sırtı: logo + desen korunur.
- Draft/maç/penaltı ekranları yeni boyutlarla taşmasın (responsive kontrol).

---

## Kabul kriterleri

1. Bota karşı tam maçta: her saha turu reveal'i ~3 sn görünür; Kilit Round sekansı baştan sona izlenebilir ve maç ekranına dönüşte banner çıkar.
2. Penaltıda berabere seri sonrası yeni atıcı seçimi yapılabilir; ani ölüm 4 karta kadar akar; maç sonu ekranı penaltı sonucundan ~3 sn sonra gelir. Kilitlenme yok.
3. Kartlar kademe renkleriyle ve stat barlarıyla render olur; üç ekranda (draft/maç/penaltı) düzgün görünür.
4. `npm test` (mevcut 67 + yeni testler) ve `npm run typecheck -w @fkd/server` yeşil.
5. Motor (`server/src/engine/`) değişmeden kalır (yalnızca `cards.ts` yardımcıları shared'a taşınabilir, davranış aynı).

## Önerilen sıra

1. Sorun 2 (kilitlenme — en kritik) → 2. Sorun 1 (tempo) → 3. Sorun 3 (Kilit Round sekansı) → 4. Sorun 4 (kart tasarımı).
İlk ikisi birlikte tek PR/commit olabilir (penaltı fix'i tempo olmadan eksik kalır).
