# Futbol Kart Düellosu — Proje Bağlamı

İki oyunculu, draft + görev bazlı 5 turluk futbol kart düellosu (web, MVP).
**Tek gerçek kaynak: `futbol-kart-oyunu-tasarim.md`** — her fazda önce onu oku.

## Çalışma şekli (önemli)

- Sistem tasarımı ve eksik/belirsiz noktalarda **kullanıcıya danışarak** ilerle; neyi nerede neden kullandığını açıkla.
- Türkçe iletişim kur.
- Client'a asla rakibin gizli bilgisi gönderilmez; tüm oyun mantığı sunucuda.

## Mimari

- npm workspaces monorepo: `shared/` (tipler + JSON veriler), `server/` (motor + testler), `client/` (Faz 2'de React+Vite+TS).
- Motor saf fonksiyonlardır (`server/src/engine/`): rng, cards, scoring, draft, match, penalty. Tüm rastgelelik seed'li RNG (`mulberry32`) ile enjekte edilir — determinizmi bozma.
- Görev formülleri `shared/data/tasks.json`'da stat-ağırlık olarak durur; kod normalize eder. Yeni görev/stat eklemek kod değişikliği gerektirmemeli.
- Draft: her turda config'ten bir **kademe kompozisyonu** seçilir (örn. alt+orta+üst, 2 orta+1 üst), iki oyuncuya aynısı uygulanır; kartlar bağımsız çekilir (rakipler arası kopya serbest, kendi elinde kopya yasak). Kademe tükenirse en yakın kademeye düşülür.
- Penaltı: 4 saha atıcısı tükenince 5. seri kaleci düellosu (atıcı gücü = kurtarış gücü); son çare tie-break: 5 kartın toplam statı → eşitse yazı-tura.

## Komutlar

```bash
npm install                      # kök dizinde
npm test                         # server birim testleri (Vitest, 67 test)
npm run typecheck -w @fkd/server
```

## Faz planı ve durum

- [x] **Faz 1 — Çekirdek motor:** shared tipler, cards/tasks/config JSON, draft+maç+penaltı saf fonksiyonları, 67 birim testi. TAMAMLANDI.
- [ ] **Faz 2 — Bot modu uçtan uca:** Socket.io altyapısı (oda/state yönetimi in-memory), kural bazlı bot (draft: en yüksek overall; tur: %70 göreve-göre-en-iyi / %30 rastgele, config'ten; penaltı: en yüksek sut×0.7+teknik×0.3; 1-2 sn yapay gecikme), React+Vite client temel UI (animasyonsuz). Kabul: bota karşı tam bir maç tarayıcıda oynanabilmeli.
- [ ] **Faz 3 — Multiplayer:** oda/link sistemi, matchmaking kuyruğu, 60 sn reconnect penceresi (match id + player token).
- [ ] **Faz 4 — Cila:** Framer Motion (kart flip, Kilit Round sekansı, penaltı sahnesi), ses, responsive.
- [ ] **Faz 5 — Deploy:** client Vercel, server Render free tier (`render.yaml` + `vercel.json` hazır), env ayarları (`.env.example` dosyalarına bak).

Socket event isimleri tasarım dokümanı §12'de tanımlı — onlara sadık kal.

## Kurallar

- Faz bitmeden sonrakine geçme; her fazda mevcut testler yeşil kalmalı, yeni mantık için test ekle.
- Motor fonksiyonlarına Socket.io/IO bağımlılığı sokma; Socket katmanı motoru çağıran ince bir kabuk olmalı.
- Kart isimleri sadece `cards.json`'da durur (canlıya çıkmadan değiştirilecek).
