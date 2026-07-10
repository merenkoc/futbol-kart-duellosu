// EA FC oyuncu veri setinden (all_players.csv) havuz bazlı kart üretimi.
// Kullanım: node tools/gen-pools.mjs [csv-yolu]
//   varsayılan csv yolu: C:/Users/erenk/Downloads/archive/all_players.csv
//
// Her havuz (shared/data/pools.json'daki tanım): en iyi 25 saha + 5 kaleci (OVR'a göre).
// Stat eşleme (EA -> oyun):
//   saha:  hiz<-PAC, sut<-SHO, pas<-PAS, dripling<-DRI, teknik<-Ball Control,
//          calim<-(Dribbling detayı + Agility)/2
//   kaleci: atlama<-GK Diving, kurtaris<-(GK Reflexes + GK Handling)/2,
//           pozisyonAlma<-GK Positioning  (boşsa OVR kullanılır)
// Kademe: havuz İÇİ göreli atanır (saha 25: 7 üst/10 orta/8 alt; kaleci 5: 1/2/2) —
// mutlak overall aralığı kullanılsaydı "en iyi 30" havuzunda herkes üst çıkar,
// draft kademe kompozisyonları anlamını yitirirdi. Kart üzerindeki `tier` alanı
// tierOf'ta hesaplanan değeri ezer (shared/src/cards.ts).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const csvPath = process.argv[2] ?? 'C:/Users/erenk/Downloads/archive/all_players.csv';
const pools = JSON.parse(readFileSync(join(root, 'shared/data/pools.json'), 'utf8'));

// --- Minimal ama doğru CSV ayrıştırıcı (tırnak içi virgül/yenisatır destekli) ---
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  return rows;
}

const raw = parseCsv(readFileSync(csvPath, 'utf8'));
const header = raw[0];
const col = (name) => {
  const idx = header.indexOf(name);
  if (idx === -1) throw new Error(`CSV kolonu yok: ${name}`);
  return idx;
};
const C = {
  name: col('Name'), ovr: col('OVR'), pac: col('PAC'), sho: col('SHO'), pas: col('PAS'),
  dri: col('DRI'), ballControl: col('Ball Control'), dribbling: col('Dribbling'), agility: col('Agility'),
  position: col('Position'), nation: col('Nation'), league: col('League'),
  gkDiving: col('GK Diving'), gkHandling: col('GK Handling'), gkReflexes: col('GK Reflexes'), gkPositioning: col('GK Positioning'),
};

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const clamp = (n) => Math.max(1, Math.min(99, Math.round(n)));

// Aynı oyuncu birden fazla satırda olabilir — en yüksek OVR'lı satırı tut.
const byName = new Map();
for (const r of raw.slice(1)) {
  if (r.length < header.length - 1) continue;
  const name = r[C.name];
  if (!name) continue;
  const prev = byName.get(name);
  if (!prev || num(r[C.ovr], 0) > num(prev[C.ovr], 0)) byName.set(name, r);
}
const players = [...byName.values()];

const slug = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ıİ]/g, 'i').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[çÇ]/g, 'c').replace(/[öÖ]/g, 'o').replace(/[üÜ]/g, 'u')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

function toCard(row, poolId, tier) {
  const isGk = row[C.position] === 'GK';
  const ovr = num(row[C.ovr], 60);
  const stats = isGk
    ? {
        atlama: clamp(num(row[C.gkDiving], ovr)),
        kurtaris: clamp((num(row[C.gkReflexes], ovr) + num(row[C.gkHandling], ovr)) / 2),
        pozisyonAlma: clamp(num(row[C.gkPositioning], ovr)),
      }
    : {
        dripling: clamp(num(row[C.dri], ovr)),
        hiz: clamp(num(row[C.pac], ovr)),
        sut: clamp(num(row[C.sho], ovr)),
        teknik: clamp(num(row[C.ballControl], ovr)),
        pas: clamp(num(row[C.pas], ovr)),
        calim: clamp((num(row[C.dribbling], ovr) + num(row[C.agility], ovr)) / 2),
      };
  return { id: `${poolId}_${slug(row[C.name])}`, name: row[C.name], position: isGk ? 'gk' : 'field', pool: poolId, tier, stats };
}

// Havuz içi göreli kademe: sıralı listede ilk N üst, sonra orta, kalan alt.
function assignTiers(sorted, ustCount, ortaCount) {
  return sorted.map((row, i) => (i < ustCount ? 'ust' : i < ustCount + ortaCount ? 'orta' : 'alt'));
}

const cards = [];
const summary = [];
for (const pool of pools) {
  const match = pool.type === 'national'
    ? (r) => r[C.nation] === pool.nation
    : (r) => r[C.league] === pool.league;
  const candidates = players.filter(match);
  const field = candidates.filter((r) => r[C.position] !== 'GK').sort((a, b) => num(b[C.ovr], 0) - num(a[C.ovr], 0)).slice(0, 25);
  const gk = candidates.filter((r) => r[C.position] === 'GK').sort((a, b) => num(b[C.ovr], 0) - num(a[C.ovr], 0)).slice(0, 5);
  if (field.length < 25 || gk.length < 5) {
    throw new Error(`Havuz eksik: ${pool.id} (saha ${field.length}/25, kaleci ${gk.length}/5)`);
  }
  const fieldTiers = assignTiers(field, 7, 10);
  const gkTiers = assignTiers(gk, 1, 2);
  field.forEach((r, i) => cards.push(toCard(r, pool.id, fieldTiers[i])));
  gk.forEach((r, i) => cards.push(toCard(r, pool.id, gkTiers[i])));
  summary.push(`${pool.id}: ${field.length}+${gk.length} kart, en iyi: ${field[0][C.name]} (${field[0][C.ovr]})`);
}

// Kart id'leri benzersiz mi?
const ids = new Set();
for (const c of cards) {
  if (ids.has(c.id)) throw new Error(`Çift id: ${c.id}`);
  ids.add(c.id);
}

writeFileSync(join(root, 'shared/data/cards.json'), JSON.stringify(cards, null, 2) + '\n', 'utf8');
console.log(summary.join('\n'));
console.log(`\nTOPLAM: ${cards.length} kart -> shared/data/cards.json`);
