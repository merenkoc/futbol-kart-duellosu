import { describe, expect, it } from 'vitest';
import { compareScores, roundPoints, taskScore } from '../src/engine/scoring.js';
import { config, fieldTasks, gkTasks, makeFieldCard, makeGkCard } from './helpers.js';

describe('taskScore — tasarım dokümanındaki formüller', () => {
  const card = makeFieldCard('test', { dripling: 70, hiz: 60, sut: 90, teknik: 84, pas: 76, calim: 88 });

  const expectTask = (id: string, expected: number) => {
    const task = fieldTasks.find((t) => t.id === id)!;
    expect(taskScore(card, task)).toBeCloseTo(expected, 10);
  };

  it('ara_pasi = (teknik + pas) / 2', () => expectTask('ara_pasi', (84 + 76) / 2));
  it('kontratak = (hiz + dripling) / 2', () => expectTask('kontratak', (60 + 70) / 2));
  it('uzaktan_sut = (sut + teknik) / 2', () => expectTask('uzaktan_sut', (90 + 84) / 2));
  it('birebir_calim = (calim + dripling) / 2', () => expectTask('birebir_calim', (88 + 70) / 2));
  it('kanat_bindirmesi = (hiz + pas) / 2', () => expectTask('kanat_bindirmesi', (60 + 76) / 2));
  it('bitiricilik = (sut + calim) / 2', () => expectTask('bitiricilik', (90 + 88) / 2));
  it('pres_direnci = (teknik + dripling) / 2', () => expectTask('pres_direnci', (84 + 70) / 2));
  it('serbest_vurus = (sut + pas) / 2', () => expectTask('serbest_vurus', (90 + 76) / 2));
  it('oyun_kurma = (pas + teknik + dripling) / 3', () => expectTask('oyun_kurma', (76 + 84 + 70) / 3));
  it('derinlik_kosusu = (hiz + sut) / 2', () => expectTask('derinlik_kosusu', (60 + 90) / 2));

  const keeper = makeGkCard('gk_test', 80, 90, 70);
  const expectGkTask = (id: string, expected: number) => {
    const task = gkTasks.find((t) => t.id === id)!;
    expect(taskScore(keeper, task)).toBeCloseTo(expected, 10);
  };

  it('uzak_sut_tutma = (atlama + kurtaris) / 2', () => expectGkTask('uzak_sut_tutma', (80 + 90) / 2));
  it('karsi_karsiya = (pozisyonAlma + kurtaris) / 2', () => expectGkTask('karsi_karsiya', (70 + 90) / 2));
  it('asirtma_tutma = (atlama + pozisyonAlma) / 2', () => expectGkTask('asirtma_tutma', (80 + 70) / 2));
  it('yakin_refleks = kurtaris×0.6 + atlama×0.4', () => expectGkTask('yakin_refleks', 90 * 0.6 + 80 * 0.4));

  it('eksik stat isteyen görev hata fırlatır', () => {
    const gkTask = gkTasks[0]!;
    expect(() => taskScore(card, gkTask)).toThrow();
  });
});

describe('karşılaştırma ve puanlama', () => {
  it('yüksek skor kazanır, eşitlik beraberlik', () => {
    expect(compareScores(85, 80)).toBe(0);
    expect(compareScores(80, 85)).toBe(1);
    expect(compareScores(85, 85)).toBe(null);
  });

  it('kazanan 3 puan, beraberlikte 1-1', () => {
    expect(roundPoints(0, config)).toEqual([3, 0]);
    expect(roundPoints(1, config)).toEqual([0, 3]);
    expect(roundPoints(null, config)).toEqual([1, 1]);
  });
});
