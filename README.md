# Futbol Kart Düellosu (MVP)

2 oyunculu draft + görev bazlı düello kart oyunu. Tasarım: `futbol-kart-oyunu-tasarim.md`.

## Yapı

- `shared/` — ortak TS tipleri + `data/cards.json`, `tasks.json`, `config.json`
- `server/` — oyun motoru (`src/engine/`) + Socket.io katmanı (`src/socket/`, `src/realtime/`) + Vitest testleri
- `client/` — React + Vite + TS (ekranlar, Framer Motion animasyonları)

## Çalıştırma

```bash
npm install        # kök dizinde (workspaces)
npm run dev        # server (3001) + client (5173) birlikte
npm test           # server + client testleri
npm run typecheck -w @fkd/server
```

## Faz durumu

- [x] Faz 1 — Çekirdek motor (saf fonksiyonlar + birim testleri)
- [x] Faz 2 — Socket.io + bot modu + temel UI
- [x] Faz 3 — Multiplayer (oda/matchmaking/reconnect)
- [x] Faz 4 — Animasyon ve cila
- [ ] Faz 5 — Deploy (Vercel + Render free tier)

## Deploy (Faz 5)

Client **Vercel**'e (statik build), server **Render free tier**'a (kalıcı Node/Socket.io süreci) gider.
Repo'daki `vercel.json` ve `render.yaml` bu kurulumu tarif eder.

**Ön koşul:** Proje GitHub'a push'lanmış olmalı (iki platform da repo'dan otomatik deploy eder).

1. **Server (Render):** Dashboard → New → **Blueprint** → bu repo'yu seç (`render.yaml` otomatik okunur;
   free plan, `/health` yoklaması ve start komutu tanımlı). Deploy bitince verilen adresi not al
   (örn. `https://fkd-server.onrender.com`).
2. **Client (Vercel):** Add New Project → bu repo. Root Directory **repo kökü** kalsın
   (`vercel.json` build'i `client/`e yönlendirir; workspaces kökten kurulmalı).
   Environment Variables: `VITE_SERVER_URL` = Render adresi. Deploy → verilen adresi not al.
3. **Halkayı kapat:** Render'da `CLIENT_ORIGIN` env değişkenine Vercel adresini yaz
   (sonunda `/` olmadan) → servis yeniden başlar. Vercel adresini aç, bota karşı bir maç oyna.

**Notlar:**
- Render free tier 15 dk hareketsizlikte uyur; ilk ziyarette uyanması 30-60 sn sürer.
  Client'taki splash ekranı bu bekleme için tasarlandı (10 sn sonra "Sunucu uyanıyor…" notu çıkar).
- Sunucu **tek instance** çalışmalı: tüm maç state'i bellekte tutulur; ölçekleme/ikinci kopya
  oyuncuları farklı makinelere düşürür. Restart'ta aktif maçlar sıfırlanır (MVP davranışı).
- `VITE_SERVER_URL` build anında gömülür — değiştirince Vercel'de yeniden deploy gerekir.
- Env örnekleri: `server/.env.example`, `client/.env.example`.

## Faz 1 tasarım kararları

- Tüm rastgelelik seed'lenebilir RNG (`mulberry32`) ile enjekte edilir → testler deterministik.
- Görev formülleri JSON'da stat-ağırlık olarak durur, kod ağırlıkları normalize eder → yeni görev = sadece JSON.
- Draft'ta her tur bir **kademe kompozisyonu** seçilir (örn. Alt+Orta+Üst, 2 Orta+1 Üst); iki oyuncuya aynı kompozisyon uygulanır, kartlar bağımsız çekilir. Kompozisyon listesi `config.json`'da.
- Kademede kart tükenirse en yakın kademeye düşülür (küçük havuzda kilitlenme olmaz).
- Penaltı son çare tie-break: 5 kartın toplam statı; o da eşitse yazı-tura.
