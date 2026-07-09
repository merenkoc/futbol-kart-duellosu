# Animasyon & Görsel Tasarım Brief'i — "Claude design" için promptlar

Amaç: oyuna Kilit Round / penaltı sahnelerindeki gibi bir **görsel şölen** katmak.
Sanat yönü: **Modern yayın / stadyum HUD** (futbol yayın grafikleri hissi —
mevcut altın/gümüş/bronz kart diliyle uyumlu).

## Nasıl ilerlemeliyiz (özet)

Tek dev prompt yerine **4 faz**, her biri ayrı prompt. Her promptun başına aşağıdaki
**ORTAK BAĞLAM** bloğunu yapıştır, sonra o fazın görev bloğunu ekle. Önerilen sıra:

1. Kart tasarımı (temel — her sahne kartı yeniden kullanır)
2. Normal tur düello animasyonu
3. Ekran geçişleri + draft açılışı
4. Maç sonu kutlaması

Her faz bitince tarayıcıda gör, `npm test` + `npm run typecheck` yeşil olduğunu
doğrula, sonra bir sonrakine geç.

---

## ORTAK BAĞLAM (her promptun başına yapıştır)

```
Bir React + Vite + TypeScript oyununun CLIENT tarafında görsel/animasyon işi
yapıyorsun. Oyun: 2 oyunculu, 5 turluk draft + düello futbol kart oyunu.
Animasyon kütüphanesi: framer-motion (v11). Sesler Web Audio ile client/src/sound.ts
içinde üretiliyor (playClick, playFlip, playWhistle, playGoal, playSave, playWin, playLose).

SANAT YÖNÜ: Modern futbol yayını / stadyum HUD. Cam gibi paneller, metalik
kademe çerçeveleri, ince ışık süpürmeleri, skor "chip"leri, broadcast alt-bant
hissi. Şık ve okunur; abartı efektler oynanabilirliği bozmamalı.

MEVCUT TASARIM SİSTEMİ (koru ve genişlet):
- Tema: koyu slate. body bg #0f172a, metin #f1f5f9. Vurgu yeşili #22c55e.
- Kademe renkleri: alt=bronz (#92400e / #d97706), orta=gümüş (#94a3b8 / #cbd5e1),
  üst=altın (#eab308 / #fbbf24, hafif glow).
- Kart: 160x224px (mobil 128x180). 3B flip yapısı var: .card-flip-outer
  (perspective) > .card-flip-inner (preserve-3d) > .card-face + .card-back-face.
- Komponentler: client/src/components/CardView.tsx (tek kart, props: card,
  disabled, selected, used, faceDown, index, animateEntrance, onClick),
  DuelArea.tsx (tur karşılaştırması), screens/ altında MainMenu, Lobby, Draft,
  MatchScreen, KeeperRound, Penalty, MatchEnd. App.tsx ekranları AnimatePresence
  (mode="wait", key={state.screen}) ile değiştiriyor.
- Stiller tek dosyada: client/src/index.css (mobil @media 640px dahil).

TEMPO SUNUCUDAN GELİR (ÇOK ÖNEMLİ — animasyonlar bu pencerelere SIĞMALI):
config.json timing → revealMs 3000ms, keeperIntroMs 2500ms, keeperRevealMs 3500ms,
penaltyResultMs 3000ms. Örn. bir turun reveal animasyonu 3 sn içinde bitmeli;
sunucu bu süre sonunda bir sonraki round:task'ı gönderir.

DEĞİŞTİRME (kesin kısıtlar):
- shared/ tiplerine, server/'a, socket event isimlerine DOKUNMA.
- Reducer action şekline ve ClientState alanlarına DOKUNMA (client/src/reducer.ts,
  types.ts). Sadece sunum katmanı: components/, screens/, index.css, gerekiyorsa sound.ts.
- CardView'in props API'sini bozma; DuelArea/MatchScreen'in sunucu verisini
  kullanma biçimini bozma.
- Kilitlenme/etkileşim mantığını geciktirme: animasyon oynanırken bile kullanıcı
  girişleri zamanında çalışmalı.

KALİTE ŞARTLARI (her değişiklikte):
- `prefers-reduced-motion: reduce` için sade fallback ver (animasyonları kısalt/kaldır).
- Mobil responsive korunmalı (kart satırları yatay scroll-snap).
- `npm test` (91 server + 3 client) ve `npm run typecheck -w @fkd/server` +
  `-w @fkd/client` yeşil kalmalı. Testleri bozacak yapısal değişiklik yapma.
- Renkleri mümkünse index.css'in başında CSS değişkenlerine (design token) taşı,
  sonra her yerde onları kullan.
```

---

## FAZ 1 — Kart tasarımı (CardView + index.css)

```
GÖREV: Kartı "yayın grafiği" kalitesine çıkar. Dosyalar: client/src/components/
CardView.tsx ve client/src/index.css.

İstenen görsel:
- Kademeye göre metalik çerçeve (bronz/gümüş/altın) + panelde hafif cam/gloss.
- Üst kademe kartlarda ince, yavaş hareket eden "holo/foil" ışık süpürmesi.
- Overall değeri sol üstte yuvarlak metalik rozet (chip); altında pozisyon etiketi.
- Stat barları mount'ta 0'dan değerine dolan animasyonla gelsin (stagger).
- Arka yüz: tekrar eden desen yerine kulüp arması hissi veren bir monogram (FKD).
- Durumlar: hover'da hafif kalkış + gölge + tek seferlik ışık süpürmesi;
  selected'da nabız gibi atan halka; used/disabled'da desatürasyon + "OYNANDI" damgası.

Kısıtlar:
- 160x224 (mobil 128x180) ve mevcut flip yapısını koru. Props API'yi değiştirme.
- overall(card) ve tierOf(card, gameConfig) kullanımını koru.

Kabul: 3 kademe de belirgin farklı görünür; hover/selected/used okunur;
prefers-reduced-motion'da foil ve nabız kapanır; testler+typecheck yeşil.
```

## FAZ 2 — Normal tur düello animasyonu (DuelArea + MatchScreen)

```
GÖREV: Her turun karşılaştırmasını dramatize et. Dosyalar: client/src/components/
DuelArea.tsx, client/src/screens/MatchScreen.tsx, index.css (ve istersen sound.ts).

Zaman bütçesi: tüm reveal sekansı revealMs = 3000ms İÇİNDE bitmeli.

Beat'ler:
1. Görev geldiğinde: üstte "GÖREV: {task} ({statlar})" yayın alt-bandı (ribbon).
   Benim kartım soldan, rakip kartı (kapalı/faceDown) sağdan kayarak girer.
2. Reveal (round:reveal): rakip kartı flip ile açılır (playFlip zaten var).
   İki skor sayısı 0'dan gerçek değerine "sayaç" animasyonuyla artar.
   Yarışılan stat(lar) kartlarda kısa vurgu alır.
3. Sonuç: kazanan kart altın/yeşil patlama + hafif "pop" (scale) + çok hafif
   ekran sarsıntısı; kaybeden hafif kararır; berabere nötr nabız.
   Kazanılan puan chip'i (+3 / +1) skor tablosuna doğru uçar.

Kısıtlar:
- DuelArea'nın props'ları (myCard, opponentCard, myScore, opponentScore, outcome)
  ve MatchScreen'in sunucu verisini kullanımı aynı kalsın.
- Sekans 3sn'yi AŞMASIN; reduced-motion'da anında/sade göster.

Kabul: kazan/kaybet/berabere üçü de net; 3sn'de tamamlanır; testler+typecheck yeşil.
```

## FAZ 3 — Ekran geçişleri + draft açılışı (App.tsx + Draft.tsx)

```
GÖREV: Ekranlar arası geçişleri ve draft seçenek açılışını yayın hissiyle canlandır.
Dosyalar: client/src/App.tsx (AnimatePresence bloğu), client/src/screens/Draft.tsx,
index.css.

İstenen:
- menu→draft→match→keeperRound→penalty→end geçişleri: broadcast "wipe/cut"
  hissi (mevcut fade+slide yerine daha karakterli ama kısa geçişler).
- Draft: seçenek kartları bir desteden "dağıtılır" gibi sırayla girsin (deal-in,
  stagger). Kart seçilince kilit "damgası"/parıltısı; rakip seçince alt-bant bilgisi.

Kısıtlar:
- AnimatePresence mode="wait" ve key={state.screen} kalsın. Geçişler kısa olsun
  (girişi geciktirmesin). Draft seçim mantığına (onPick, disabled/locked) dokunma.

Kabul: geçişler akıcı ve hızlı; draft açılışı "şölen" hissi verir; testler+typecheck yeşil.
```

## FAZ 4 — Maç sonu kutlaması (MatchEnd.tsx)

```
GÖREV: Bitiş ekranını dramatize et. Dosya: client/src/screens/MatchEnd.tsx, index.css
(ve istersen sound.ts — playWin/playLose var).

İstenen:
- Kazandın: stadyum ışıkları/spot, hafif konfeti, kupa ve büyüyen final skoru.
  Tur geçmişi (state.history) bir zaman çizelgesi gibi sırayla belirsin.
- Kaybettin: kararmış, saygılı, sade ton.
- decidedBy etiketi korunsun (score / penalty / forfeit → mevcut Türkçe metinler).
- "Tekrar Oyna" ve "Ana Menü" butonları yayın stilinde; rematch bekleme durumu korunsun.

Kısıtlar:
- Konfeti hafif olsun (canvas ya da birkaç motion parçacığı), reduced-motion'da kapansın.
- EndUiState alanlarını (winner, decidedBy, finalScores, history, rematchRequested*)
  ve buton davranışını (onRematch/onMenu, disabled) değiştirme.

Kabul: kazan/kaybet belirgin; skor+geçmiş okunur; reduced-motion sade; testler+typecheck yeşil.
```

---

## Notlar

- Bu fazlar CLAUDE.md'deki Faz 4 (Cila) kapsamına girer; motor ve socket sözleşmesi
  değişmediği için mevcut 91+3 test aynen geçerli kalmalı.
- İstersen Faz 1'den önce küçük bir "design token" fazı ekleyip index.css başında
  renk/gölge/geçiş değişkenlerini tanımlatabilirsin; sonraki fazlar onları kullanır.
