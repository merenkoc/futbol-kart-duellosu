import { useState } from 'react';
import type { LobbyUiState } from '../types.js';

interface Props {
  state: LobbyUiState;
}

export function Lobby({ state }: Props) {
  const [copied, setCopied] = useState(false);
  const link = state.roomId ? `${window.location.origin}${window.location.pathname}?room=${state.roomId}` : null;

  return (
    <div className="screen lobby-screen">
      {state.mode === 'creating' && (
        <>
          <h2>Arkadaşla Oyna</h2>
          {link ? (
            <>
              <p>Bu linki arkadaşına gönder:</p>
              <div className="room-link">
                <code>{link}</code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(link).catch(() => {});
                    setCopied(true);
                  }}
                >
                  {copied ? 'Kopyalandı' : 'Kopyala'}
                </button>
              </div>
              <p className="status">Rakip bekleniyor…</p>
            </>
          ) : (
            <p className="status">Oda hazırlanıyor…</p>
          )}
        </>
      )}
      {state.mode === 'joining' && (
        <>
          <h2>Odaya katılıyor…</h2>
          <p className="status">Bağlantı kuruluyor…</p>
        </>
      )}
      {state.mode === 'queue' && (
        <>
          <h2>Rastgele Eşleş</h2>
          <p className="status">Eşleşme aranıyor…</p>
        </>
      )}
    </div>
  );
}
