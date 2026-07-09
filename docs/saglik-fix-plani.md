# Sağlık Fix Planı — K1 + K2 + Y1 (Claude Code'da uygula)

Kaynak: `docs/saglik-kontrolu-raporu.md`. Üç düzeltme, hepsi sandbox'ta uygulanıp uçtan uca
doğrulandı. Sıra: K1 → K2 → Y1. Her adımda `npm test` ve `npm run typecheck -w @fkd/server`
yeşil kalmalı. Motor (`engine/`) davranışı değişmez; K1 yalnızca `session` kabuğunda.

---

## K1 — Kaleci penaltıda atıcı listesine sızıyor

**Dosya:** `server/src/game/session.ts` → `availableShooterIds`

**Kök neden:** Kilit Round'da kaleci de `matchState.usedCardIds`'e ekleniyor; metod bunu
saha kartı sanıp döndürüyor. Bot bu id'yi `hand.fieldCards.find` ile eşleyemeyince `undefined`
→ `shooterPower` çöküyor → penaltı sonsuz "rakip bekleniyor".

**Değişiklik:**
```ts
availableShooterIds(playerIdx: 0 | 1): string[] {
  // usedCardIds Kilit Round'da kalecinin id'sini de içerir; atıcı SADECE saha kartı olabilir.
  const fieldIds = new Set(this.hands![playerIdx].fieldCards.map((c) => c.id));
  const usedInMatch = this.matchState!.usedCardIds[playerIdx];
  const usedAsShooter = this.penaltyState!.usedShooterIds[playerIdx];
  return usedInMatch.filter((id) => fieldIds.has(id) && !usedAsShooter.includes(id));
}
```

**Regresyon testi** (`server/tests/session.penalty.test.ts` içine, mevcut penaltı testinin
yanına): tam bir maçı penaltıya taşı ve doğrula —
```ts
// Kilit Round sonrası availableShooterIds kaleci id'sini ASLA içermemeli
expect(session.availableShooterIds(0)).not.toContain(session.hands![0].goalkeeper.id);
expect(session.availableShooterIds(0).length).toBeGreaterThan(0);
// Ve dönen her id gerçekten saha kartı olmalı
for (const id of session.availableShooterIds(0)) {
  expect(session.hands![0].fieldCards.some((c) => c.id === id)).toBe(true);
}
```
Not: penaltıya ulaşmak için maçı beraberlikle bitirmek gerekir. Mevcut `session.penalty.test.ts`
zaten penaltıya ulaşan bir kurulum içeriyorsa onu kullan; yoksa `scoring.win=0` gibi bir override
yerine, iki oyuncuya aynı kartları oynatıp her turu berabere bitiren deterministik bir seed seç.

---

## K2 — Socket payload doğrulaması yok (sunucuyu düşürüyor)

**Dosya:** `server/src/socket/handlers.ts`

Aşağıdaki 5 handler'ın imzasını payload'ı tip-güvenli çözecek şekilde değiştir. Davranış:
geçersiz/eksik alan boş string'e düşer, mevcut "geçersiz" dalları (örn. "Oda bulunamadı",
"Kart sunulan seçenekler arasında değil") zaten bunu ele alır.

```ts
socket.on('room:join', (payload) =>
  lobby.joinRoom(typeof payload?.roomId === 'string' ? payload.roomId : '', socket)
);

socket.on('match:reconnect', (payload) => {
  const matchId = typeof payload?.matchId === 'string' ? payload.matchId : '';
  const playerToken = typeof payload?.playerToken === 'string' ? payload.playerToken : '';
  // ...mevcut gövde aynen devam...
});

socket.on('draft:pick', (payload) => {
  const cardId = typeof payload?.cardId === 'string' ? payload.cardId : '';
  // ...mevcut gövde...
});

socket.on('round:playCard', (payload) => {
  const cardId = typeof payload?.cardId === 'string' ? payload.cardId : '';
  // ...mevcut gövde...
});

socket.on('penalty:pickShooter', (payload) => {
  const cardId = typeof payload?.cardId === 'string' ? payload.cardId : '';
  // ...mevcut gövde...
});
```

**Doğrulama testi:** handler'lar `io` gerektirdiği için birim test yerine küçük bir entegrasyon
smoke'u yeterli (opsiyonel ama önerilir): bir socket.io sunucusu ayağa kaldır, sırayla
`room:join` (payloadsız), `draft:pick` ({}), `round:playCard` ({cardId: 42}),
`match:reconnect` (payloadsız), `penalty:pickShooter` ('x') gönder; sunucunun **ayakta kaldığını**
ve `error` event'i döndürdüğünü doğrula. Alternatif: en azından manuel olarak `npm run dev`
sonrası bu event'leri konsoldan atıp sürecin düşmediğini gör.

---

## Y1 — Bot zamanlayıcılarını try/catch ile sar (savunma katmanı)

**Dosya:** `server/src/socket/handlers.ts` → `scheduleBotDraftPick`, `scheduleBotRoundPick`,
`scheduleBotShooterPick`. Her birinde `setTimeout` gövdesindeki guard'dan SONRAKI motor
çağrılarını sar:

```ts
// örnek: scheduleBotShooterPick içindeki setTimeout gövdesi
if (store.getEntry(session.id)?.session !== session || session.phase !== 'penalty') return;
try {
  const card = session.botShooterChoice();
  session.pickShooter(1, card.id);
  handlePenaltyAdvance(session, 1);
} catch (err) {
  console.error('[bot] penaltı hatası:', err);
}
```
Diğer ikisinde de aynı desen (`draftPick`/`playCard` çağrıları). Amaç: `setTimeout` içindeki
bir motor `throw`'u tüm süreci öldürmesin. K1 zaten kök nedeni kapatıyor; bu genel dayanıklılık.

---

## Bitince
- `npm test` (server 85+ / client 3) ve `npm run typecheck -w @fkd/server` yeşil.
- Bota karşı bir maçı bilerek beraberlikle penaltıya taşıyıp (aynı kartlar) kilitlenmeden
  bittiğini tarayıcıda gör.
- İstersen O1 (bot maçında localStorage/reconnect uyumsuzluğu) ve O2 (kuyruğa çift giriş)
  ayrı bir temizlik turuna kalabilir.
```

Claude Code'a verilecek kısa komut:

> `docs/saglik-fix-plani.md` ve `docs/saglik-kontrolu-raporu.md`'yi oku. K1, K2, Y1'i sırayla
> uygula, her biri için belirtilen regresyon/smoke testlerini ekle, `npm test` ve
> `npm run typecheck -w @fkd/server` yeşil kalsın. Motor (`engine/`) davranışını değiştirme.
