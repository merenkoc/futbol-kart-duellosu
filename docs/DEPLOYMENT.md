# Yayına Alma (Deploy)

Client **Vercel**'e statik build olarak gider. Server ise sürekli çalışan bir Node/Socket.io süreci gerektirdiği için **Render**'ın ücretsiz planına gider. Repodaki `vercel.json` ve `render.yaml` bu kurulumu tanımlar. İki platform da GitHub reposundan otomatik deploy eder.

## 1. Server (Render)

1. Render Dashboard → **New → Blueprint** → bu repoyu seç.
2. `render.yaml` otomatik okunur. Ücretsiz plan, `/health` kontrolü ve başlatma komutu orada tanımlı.
3. Deploy bitince verilen adresi not al (örneğin `https://fkd-server.onrender.com`).

## 2. Client (Vercel)

1. **Add New Project** → bu repoyu seç.
2. Root Directory **repo kökü** olarak kalsın. `vercel.json` build'i `client/` klasörüne yönlendirir; workspaces kökten kurulmalı.
3. Environment Variables: `VITE_SERVER_URL` = Render adresi.
4. Deploy et ve verilen adresi not al.

## 3. İkisini bağla

Render'da `CLIENT_ORIGIN` ortam değişkenine Vercel adresini yaz (sonunda `/` olmadan). Servis yeniden başlar. Ardından Vercel adresini açıp bota karşı bir maç oyna.

## Notlar

- **Uyku modu:** Render'ın ücretsiz planı 15 dakika kullanılmazsa uykuya geçer; ilk ziyarette uyanması 30–60 saniye sürer. Client'taki açılış ekranı bu bekleme için tasarlandı: 10 saniye sonra "Sunucu uyanıyor…" notu çıkar.
- **Tek kopya:** sunucu tek instance çalışmalı. Tüm maç state'i bellekte tutulur; ikinci bir kopya oyuncuları farklı makinelere düşürür. Yeniden başlatmada aktif maçlar sıfırlanır.
- **Build anında gömülür:** `VITE_SERVER_URL` build sırasında koda yazılır. Değiştirirsen Vercel'de yeniden deploy gerekir.
- **Ortam değişkeni örnekleri:** `server/.env.example`, `client/.env.example`.
