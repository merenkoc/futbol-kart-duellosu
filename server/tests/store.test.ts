import { afterEach, describe, expect, it, vi } from 'vitest';
import * as store from '../src/realtime/store.js';
import type { MatchSession } from '../src/game/session.js';
import type { TypedSocket } from '../src/realtime/types.js';

function fakeSocket(id: string): TypedSocket {
  return { id, emit: vi.fn() } as unknown as TypedSocket;
}

function fakeSession(id: string): MatchSession {
  return { id } as unknown as MatchSession;
}

describe('realtime/store', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('createEntry iki socket için de link kurar', () => {
    const session = fakeSession('m1');
    const a = fakeSocket('sa');
    const b = fakeSocket('sb');
    store.createEntry(session, [a, b]);

    expect(store.getLink('sa')).toEqual({ matchId: 'm1', playerIdx: 0 });
    expect(store.getLink('sb')).toEqual({ matchId: 'm1', playerIdx: 1 });
    expect(store.getSocket('m1', 0)).toBe(a);
    expect(store.getSocket('m1', 1)).toBe(b);

    store.deleteEntry('m1');
  });

  it('bot maçında ikinci socket null olabilir', () => {
    const session = fakeSession('m2');
    const a = fakeSocket('sa2');
    store.createEntry(session, [a, null]);

    expect(store.getSocket('m2', 1)).toBeNull();
    store.deleteEntry('m2');
  });

  it('unregisterSocket o koltuğu boşaltır ve linki döner', () => {
    const session = fakeSession('m3');
    const a = fakeSocket('sa3');
    const b = fakeSocket('sb3');
    store.createEntry(session, [a, b]);

    const link = store.unregisterSocket('sa3');
    expect(link).toEqual({ matchId: 'm3', playerIdx: 0 });
    expect(store.getSocket('m3', 0)).toBeNull();
    expect(store.getSocket('m3', 1)).toBe(b);
    expect(store.getLink('sa3')).toBeUndefined();

    store.deleteEntry('m3');
  });

  it('rebindSocket yeni socket ile koltuğu doldurur ve disconnect timer\'ı iptal eder', () => {
    vi.useFakeTimers();
    const session = fakeSession('m4');
    const a = fakeSocket('sa4');
    const b = fakeSocket('sb4');
    store.createEntry(session, [a, b]);
    store.unregisterSocket('sa4');

    const onTimeout = vi.fn();
    const timer = setTimeout(onTimeout, 1000) as unknown as NodeJS.Timeout;
    store.setDisconnectTimer('m4', 0, timer);

    const reconnected = fakeSocket('sa4-new');
    store.rebindSocket('m4', 0, reconnected);
    expect(store.getSocket('m4', 0)).toBe(reconnected);
    expect(store.getLink('sa4-new')).toEqual({ matchId: 'm4', playerIdx: 0 });

    vi.advanceTimersByTime(2000);
    expect(onTimeout).not.toHaveBeenCalled();

    store.deleteEntry('m4');
  });

  it('rebindSocket koltuktaki eski socket\'in linkini düşürür (çift sekme koruması)', () => {
    const session = fakeSession('m4b');
    const oldTab = fakeSocket('tab-old');
    const b = fakeSocket('sb4b');
    store.createEntry(session, [oldTab, b]);

    // Eski sekme disconnect OLMADAN aynı token'la yeni sekme reconnect ediyor.
    const newTab = fakeSocket('tab-new');
    store.rebindSocket('m4b', 0, newTab);

    expect(store.getSocket('m4b', 0)).toBe(newTab);
    expect(store.getLink('tab-new')).toEqual({ matchId: 'm4b', playerIdx: 0 });
    // Eski sekme artık maça bağlı sayılmaz — hamle gönderemez.
    expect(store.getLink('tab-old')).toBeUndefined();

    store.deleteEntry('m4b');
  });

  it('deleteEntry tüm linkleri ve timer\'ları temizler', () => {
    const session = fakeSession('m5');
    const a = fakeSocket('sa5');
    const b = fakeSocket('sb5');
    store.createEntry(session, [a, b]);
    store.deleteEntry('m5');

    expect(store.getEntry('m5')).toBeUndefined();
    expect(store.getLink('sa5')).toBeUndefined();
    expect(store.getLink('sb5')).toBeUndefined();
  });

  it('sweep: iki tarafı da boş + süresi geçmiş zombi maçları siler, canlıları korur', () => {
    vi.useFakeTimers();
    store.createEntry(fakeSession('gc-empty'), [null, null]);
    const live = fakeSocket('gc-live-s');
    store.createEntry(fakeSession('gc-live'), [live, null]);

    expect(store.sweep(1000)).toBe(0); // taze, süresi geçmedi
    vi.advanceTimersByTime(1500);
    expect(store.sweep(1000)).toBe(1); // sadece iki tarafı boş olan
    expect(store.getEntry('gc-empty')).toBeUndefined();
    expect(store.getEntry('gc-live')).toBeDefined();

    store.deleteEntry('gc-live');
  });
});
