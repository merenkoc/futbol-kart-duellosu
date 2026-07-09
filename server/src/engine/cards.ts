/**
 * `overall`/`tierOf`/`validateCard` client de kullanabilsin diye `shared/src/cards.ts`'e
 * taşındı (Faz 4 Sorun 4 — kart tasarımında kademe rengi için client'ın da bu
 * fonksiyonlara ihtiyacı var). Motor davranışı değişmedi, sadece re-export.
 */
export { overall, tierOf, validateCard } from '@fkd/shared';
