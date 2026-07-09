import type { GameConfig, Task } from '@fkd/shared';
import rawConfig from '../../shared/data/config.json';
import rawTasks from '../../shared/data/tasks.json';

/**
 * Kademe renkleri (bronz/gümüş/altın) gibi salt kozmetik client hesapları için
 * `config.json` doğrudan import edilir — server'daki `data/loadData.ts` ile
 * aynı dosya, tek gerçek kaynak (CLAUDE.md). Socket üzerinden ayrıca taşınmaz.
 */
export const gameConfig = rawConfig as unknown as GameConfig;

const tasks = rawTasks as unknown as { field: Task[]; gk: Task[] };
const nameById: Record<string, string> = {};
for (const t of [...tasks.field, ...tasks.gk]) nameById[t.id] = t.name;

/** Görev id'sini (ör. "derinlik_kosusu") okunur ada ("Derinlik Koşusu") çevirir. */
export function taskName(id: string): string {
  return nameById[id] ?? id;
}

/** Stat anahtarlarının Türkçe, baş harfi büyük gösterim etiketleri. */
const STAT_LABELS: Record<string, string> = {
  dripling: 'Dripling',
  hiz: 'Hız',
  sut: 'Şut',
  teknik: 'Teknik',
  pas: 'Pas',
  calim: 'Çalım',
  atlama: 'Atlama',
  kurtaris: 'Kurtarış',
  pozisyonAlma: 'Pozisyon Alma',
};

/** Stat anahtarını ("sut") okunur etikete ("Şut") çevirir. */
export function statLabel(key: string): string {
  return STAT_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}
