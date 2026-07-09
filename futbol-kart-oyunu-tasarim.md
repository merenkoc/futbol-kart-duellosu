# Futbol Kart Düellosu — Oyun Tasarım Dokümanı (MVP)

## 1. Oyun Özeti
İki oyunculu, tur bazlı bir web kart oyunu. Oyuncular futbolcu kartlarıyla draft yapar, ardından görev bazlı 5 turluk bir 1v1 düello oynar. Beraberlik durumunda penaltı turu oynanır. MVP tek maçlıktır: hesap yok, koleksiyon yok, maç bitince her şey sıfırlanır.

## 2. Teknoloji Stack'i (kesinleşti)
- **Frontend:** React + Vite + TypeScript
- **Animasyon:** Framer Motion (kart flip, kilit round sekansı, penaltı sahnesi)
- **Backend:** Node.js + TypeScript + Socket.io (oda sistemi, kör seçim gizliliği için tüm oyun mantığı sunucuda)
- **State:** In-memory (sunucu RAM'i, maç bitince silinir)
- **Kart/görev verisi:** JSON konfigürasyon dosyaları (`cards.json`, `tasks.json`, `config.json`)
- **Bot:** Kural bazlı (heuristik), sunucu tarafında
- **Deploy hedefi:** Frontend Vercel, backend Render free tier (geliştirme aşamasında lokal). Render free 15 dk hareketsizlikte uyur; soğuk başlangıç splash ekranı (#24) bu bekleme için tasarlandı.
- **Monorepo yapısı:** `/client`, `/server`, `/shared` (ortak tipler ve JSON konfigürasyonlar)

## 3. Oyun Modları
1. **Arkadaşla oyna:** Oda oluşturulur, link paylaşılır, rakip linkten katılır.
2. **Rastgele eşleşme:** Matchmaking kuyruğu, ilk uygun iki oyuncu eşleşir.
3. **Bota karşı:** Anında başlar, bot sunucuda çalışır.

## 4. Kart Modeli

### Saha oyuncusu statları (0–99)
`dripling, hiz, sut, teknik, pas, calim`
(İleride yeni stat eklenebilir olmalı — stat listesi JSON'dan gelmeli, hard-code edilmemeli.)

### Kaleci statları (0–99)
`atlama, kurtaris, pozisyonAlma`

### Overall ve kademe sistemi
- Saha oyuncusu overall = 6 statın ortalaması (yuvarlanır).
- Kaleci overall = 3 statın ortalaması.
- Kademeler (config'ten ayarlanabilir): **Alt** 75–82, **Orta** 83–88, **Üst** 89–95.
- Kart isimleri şimdilik gerçek futbolcular (Arda Güler, Kenan Yıldız, Barış Alper vb.). Canlıya alınmadan değiştirilecek — bu yüzden isimler sadece `cards.json` içinde durmalı.
- Başlangıç havuzu: ~30 saha oyuncusu + ~10 kaleci (her kademeden dengeli dağılım). Statları futbolcuların gerçek profillerine makul şekilde uydur.

## 5. Draft Aşaması
- 5 seçim turu vardır; her turda her oyuncuya **3 kart** sunulur, **1'ini** seçer.
- **3. tur kaleci turudur:** 3 kaleci sunulur, 1'i seçilir.
- Sonuç: her oyuncunun eli = 4 saha kartı + 1 kaleci.

### Havuz kuralları
- Ortak havuz: iki oyuncuya **aynı kart sunulabilir ve ikisi de seçebilir** (kopya kartlar rakipler arasında serbest).
- Bir oyuncunun **kendi elinde aynı kart iki kez asla olamaz**; oyuncuya sunulan 3'lüde de daha önce seçtiği kart çıkamaz.
- **Seçilmeyen kartlar havuza geri döner**, sonraki turlarda tekrar sunulabilir.

### Adalet mekanizması
- Her draft turunda 3'lü seçenekler **aynı kademeden** gelir.
- İki oyuncuya aynı turda **aynı kademe** sunulur.
- Kademe sırası maç başında rastgele belirlenir ama iki oyuncu için aynıdır (örn. T1: Orta, T2: Üst, T3: kaleci-Orta, T4: Alt, T5: Üst).
- Rakibin seçtiği kartlar **gizlidir**; sadece ilgili düello turunda karşılaştırma anında açılır.

## 6. Maç Aşaması (5 tur)

### Tur akışı (turlar 1, 2, 4, 5 — saha turları)
1. Sunucu görev havuzundan rastgele bir görev çeker (aynı maçta görev tekrar etmez) ve **iki oyuncuya önce görevi açıklar**.
2. İki oyuncu **kör seçimle** (eş zamanlı, rakip görmeden) elindeki kullanılmamış saha kartlarından birini oynar.
3. İki seçim de kilitlenince kartlar açılır (flip animasyonu), görev formülüne göre skorlar hesaplanır ve karşılaştırılır.
4. Kazanan **3 puan**, beraberlikte **iki oyuncu da 1'er puan** alır.
5. Oynanan saha kartı o maçta tekrar kullanılamaz.

### 3. tur — Kilit Round (kaleci turu)
- Kart seçimi yoktur: iki oyuncunun kalecisi **otomatik** sahaya sürülür.
- Özel bir "Kilit Round" animasyon sekansı oynar (kalecilerin dramatik karşılaşması).
- Kaleci görev havuzundan rastgele bir görev çekilir, formüle göre karşılaştırılır, puanlama aynıdır (3 / 1-1).
- Kaleci kartı saha turlarında **oynanamaz**; saha kartı kaleci turunda **oynanamaz**.

### Görev tablosu — saha (`tasks.json`)
| ID | Görev | Formül |
|---|---|---|
| ara_pasi | Ara Pası | (teknik + pas) / 2 |
| kontratak | Kontratak | (hiz + dripling) / 2 |
| uzaktan_sut | Uzaktan Şut | (sut + teknik) / 2 |
| birebir_calim | Birebir Çalım | (calim + dripling) / 2 |
| kanat_bindirmesi | Kanat Bindirmesi | (hiz + pas) / 2 |
| bitiricilik | Bitiricilik | (sut + calim) / 2 |
| pres_direnci | Pres Direnci | (teknik + dripling) / 2 |
| serbest_vurus | Serbest Vuruş | (sut + pas) / 2 |
| oyun_kurma | Oyun Kurma | (pas + teknik + dripling) / 3 |
| derinlik_kosusu | Derinlik Koşusu | (hiz + sut) / 2 |

Her maçta bu havuzdan 4 görev çekilir (tekrarsız). Formüller JSON'da stat-ağırlık listesi olarak tanımlanmalı (örn. `{"teknik": 0.5, "pas": 0.5}`) ki yeni görev eklemek kod değişikliği gerektirmesin.

### Görev tablosu — kaleci
| ID | Görev | Formül |
|---|---|---|
| uzak_sut_tutma | Uzaktan Şutu Tutma | (atlama + kurtaris) / 2 |
| karsi_karsiya | Karşı Karşıya | (pozisyonAlma + kurtaris) / 2 |
| asirtma_tutma | Aşırtmayı Tutma | (atlama + pozisyonAlma) / 2 |
| yakin_refleks | Yakın Mesafe Refleksi | (kurtaris × 0.6 + atlama × 0.4) |

## 7. Puanlama ve Maç Sonucu
- Tur kazanma: 3 puan. Tur beraberliği: her iki oyuncuya 1 puan.
- 5 tur sonunda toplam puanı yüksek olan maçı kazanır.
- Toplam puanlar eşitse → **Penaltı Turu**.

## 8. Penaltı Turu
- Her oyuncu, maçta kullandığı 4 saha kartından birini **atıcı** olarak geri çağırır (kör seçim).
- Atıcı gücü = `sut × 0.7 + teknik × 0.3`
- Kaleci kurtarış gücü = `(atlama + kurtaris + pozisyonAlma) / 3`
- Her iki taraf birer penaltı atar: atıcı gücü rakip kalecinin kurtarış gücünden **yüksekse gol**, değilse kurtarış.
- Sonuç gol sayısıyla belirlenir. Hâlâ beraberse: **ani ölüm** — oyuncular kalan kartlarından yeni atıcı seçerek tekrar atar.
- 4 saha kartı da tükenirse **5. seri kaleci düellosudur**: kaleciler penaltı atar; kalecinin atıcı gücü = kendi kurtarış gücü (3 statının ortalaması). Ortalaması yüksek olan kaleci gol atar.
- Kaleci düellosu da berabere biterse: toplam el statı (5 kartın tüm statları) yüksek olan kazanır; o da eşitse yazı-tura (son çare tie-break). Tie-break sonucu oyuncuya ekranda açıklanır.
- Penaltı sahnesi için özel animasyon sekansı (Framer Motion).

## 9. Bot Tasarımı (kural bazlı)
- **Draft:** Sunulan 3 karttan, statları çeşitlilik sağlayacak olanı seçer (basit versiyon: en yüksek overall; geliştirilmiş: elindeki zayıf stat alanını tamamlayan).
- **Tur kart seçimi:** %70 ihtimalle açıklanan göreve göre en yüksek skoru verecek kartı, %30 ihtimalle rastgele bir kartı oynar (config'ten ayarlanabilir zorluk parametresi).
- **Penaltı:** En yüksek `sut×0.7+teknik×0.3` değerli kartı seçer.
- Bot kararları arasına 1–2 sn yapay gecikme (insansı his).

## 10. Ekranlar
1. **Ana menü:** 3 mod butonu (Arkadaşla Oyna / Rastgele Eşleş / Bota Karşı), oyun adı/logosu.
2. **Lobi:** Oda linki kopyalama, rakip bekleme durumu; matchmaking'de kuyruk animasyonu.
3. **Draft ekranı:** 3 kart seçeneği (flip ile açılır), tur göstergesi (1–5), seçilen kartların gizli/kapalı gösterimi, rakibin "seçim yaptı" durumu.
4. **Maç ekranı:** Skor tablosu, tur göstergesi, açıklanan görev kartı, oyuncunun eli (kullanılanlar soluk), rakip tarafı kapalı kartlar, karşılaştırma/sonuç animasyon alanı.
5. **Kilit Round sekansı:** 3. turda otomatik kaleci karşılaşması animasyonu.
6. **Penaltı ekranı:** Atıcı seçimi + penaltı animasyonu.
7. **Maç sonu:** Kazanan, skor özeti, tur tur döküm, "Tekrar Oyna / Ana Menü".

## 11. Veri Modeli (sunucu, in-memory)
```
Match {
  id, mode: 'friend' | 'matchmaking' | 'bot',
  players: [PlayerState, PlayerState],
  phase: 'lobby' | 'draft' | 'match' | 'penalty' | 'finished',
  draftState: { turn: 1-5, tierOrder, currentOptions: {p1: Card[3], p2: Card[3]} },
  matchState: { round: 1-5, tasks: Task[5], scores: [n, n], roundHistory: RoundResult[] },
  penaltyState?: {...}
}
PlayerState {
  socketId, nickname, hand: { fieldCards: Card[4], goalkeeper: Card },
  usedCardIds: string[], isBot: boolean, connected: boolean
}
```
- Kopukluk yönetimi: oyuncu düşerse 60 sn reconnect penceresi (socketId yenilenir, match id + player token ile geri bağlanır); süre dolarsa rakip hükmen kazanır.

## 12. Socket Event Listesi (öneri)
**Client → Server:** `room:create`, `room:join`, `queue:join`, `bot:start`, `draft:pick`, `round:playCard`, `penalty:pickShooter`, `match:rematch`
**Server → Client:** `room:created`, `match:start`, `draft:options`, `draft:opponentPicked`, `draft:complete`, `round:task`, `round:waitingOpponent`, `round:reveal` (iki kart + skorlar + kazanan), `match:score`, `keeperRound:start`, `penalty:start`, `penalty:result`, `match:end`, `opponent:disconnected`, `opponent:reconnected`, `error`

Güvenlik ilkesi: client'a asla rakibin gizli bilgisi (eldeki kartlar, seçenekler, kilitlenmemiş seçimler) gönderilmez. Tüm hesaplamalar sunucuda yapılır, client sadece sonuçları render eder.

## 13. Geliştirme Faz Planı
1. **Faz 1 — Çekirdek motor:** Monorepo kurulumu, shared tipler, `cards.json` + `tasks.json`, sunucuda draft + maç + penaltı motorunun saf fonksiyonlar olarak yazılması ve birim testleri (UI'sız).
2. **Faz 2 — Bot modu uçtan uca:** Socket.io altyapısı + bota karşı tam oyun akışı + temel UI (animasyonsuz). *(İlk oynanabilir sürüm burası.)*
3. **Faz 3 — Multiplayer:** Oda/link sistemi, matchmaking kuyruğu, reconnect yönetimi.
4. **Faz 4 — Cila:** Framer Motion animasyonları (kart flip, kilit round, penaltı sekansı), ses efektleri, responsive tasarım (mobil tarayıcı desteği).
5. **Faz 5 — Deploy:** Vercel (client) + Render free tier (server) kurulumu, environment ayarları.

## 14. MVP Dışı (şimdilik yapılmayacak)
Hesap sistemi, kart koleksiyonu/ekonomisi, ELO/sıralama, gerçek isimlerin lisanslı içerikle değiştirilmesi, turnuva modu, sohbet.
