import { describe, expect, it, vi } from 'vitest';
import { createLobby } from '../src/realtime/lobby.js';
import type { TypedSocket } from '../src/realtime/types.js';

function fakeSocket(id: string): TypedSocket {
  return { id, emit: vi.fn() } as unknown as TypedSocket;
}

describe('realtime/lobby', () => {
  it('createRoom + joinRoom eşleşince beginMatch(\'friend\', ..., host havuzu) çağırır', () => {
    const beginMatch = vi.fn();
    const lobby = createLobby(beginMatch);
    const host = fakeSocket('host');
    const guest = fakeSocket('guest');

    lobby.createRoom(host, 'premier');
    expect(host.emit).toHaveBeenCalledWith('room:created', { roomId: expect.any(String) });
    const roomId = (host.emit as ReturnType<typeof vi.fn>).mock.calls[0]![1].roomId as string;

    lobby.joinRoom(roomId, guest);
    expect(beginMatch).toHaveBeenCalledWith('friend', [host, guest], 'premier');
  });

  it('olmayan bir odaya katılmak guest\'e error emit eder', () => {
    const beginMatch = vi.fn();
    const lobby = createLobby(beginMatch);
    const guest = fakeSocket('guest2');

    lobby.joinRoom('yok-boyle-bir-oda', guest);
    expect(guest.emit).toHaveBeenCalledWith('error', { message: 'Oda bulunamadı' });
    expect(beginMatch).not.toHaveBeenCalled();
  });

  it('joinQueue: ilk oyuncu bekler, ikinci gelince İLK GİRENİN havuzuyla eşleşir', () => {
    const beginMatch = vi.fn();
    const lobby = createLobby(beginMatch);
    const first = fakeSocket('q1');
    const second = fakeSocket('q2');

    lobby.joinQueue(first, 'superlig');
    expect(first.emit).toHaveBeenCalledWith('queue:waiting');
    expect(beginMatch).not.toHaveBeenCalled();

    lobby.joinQueue(second, 'laliga');
    expect(beginMatch).toHaveBeenCalledWith('matchmaking', [first, second], 'superlig');
  });

  // docs/saglik-kontrolu-raporu.md O2: aynı socket üst üste queue:join yollarsa
  // kuyrukta birden fazla kez durmamalı. Bu invariant'ı sabitliyor (ileride
  // joinQueue yeniden yazılırsa duplicate/çoklu eşleşme regresyonunu yakalar).
  it('aynı socket üst üste joinQueue çağırırsa kuyrukta bir kez durur, tam bir kez eşleşir', () => {
    const beginMatch = vi.fn();
    const lobby = createLobby(beginMatch);
    const first = fakeSocket('dup1');
    const second = fakeSocket('dup2');

    lobby.joinQueue(first, 'turkiye');
    lobby.joinQueue(first, 'turkiye');
    lobby.joinQueue(first, 'turkiye');
    expect(beginMatch).not.toHaveBeenCalled();

    // İkinci farklı socket gelince tam olarak BİR kez eşleşmeli (first iki kez değil).
    lobby.joinQueue(second, 'turkiye');
    expect(beginMatch).toHaveBeenCalledTimes(1);
    expect(beginMatch).toHaveBeenCalledWith('matchmaking', [first, second], 'turkiye');

    // Kuyruk artık boş: üçüncü bir socket gelince "second" ile değil, yeni bekleyen olarak durmalı.
    const third = fakeSocket('dup3');
    lobby.joinQueue(third, 'turkiye');
    expect(third.emit).toHaveBeenCalledWith('queue:waiting');
    expect(beginMatch).toHaveBeenCalledTimes(1);
  });

  it('forget: bekleyen odayı/kuyruğu temizler, sonraki katılım eşleşmez', () => {
    const beginMatch = vi.fn();
    const lobby = createLobby(beginMatch);
    const host = fakeSocket('host2');
    const guest = fakeSocket('guest3');

    lobby.createRoom(host, 'turkiye');
    const roomId = (host.emit as ReturnType<typeof vi.fn>).mock.calls[0]![1].roomId as string;
    lobby.forget(host);

    lobby.joinRoom(roomId, guest);
    expect(guest.emit).toHaveBeenCalledWith('error', { message: 'Oda bulunamadı' });
  });
});
