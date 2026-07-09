interface Props {
  onStartBot: () => void;
  onCreateRoom: () => void;
  onJoinQueue: () => void;
}

export function MainMenu({ onStartBot, onCreateRoom, onJoinQueue }: Props) {
  return (
    <div className="screen menu-screen">
      <div className="menu-crest-ring" aria-hidden>
        <span className="menu-crest-monogram">FKD</span>
      </div>
      <h1 className="menu-title">Futbol Kart Düellosu</h1>
      <p className="menu-subtitle">Draft · Düello · 5 Tur</p>
      <div className="menu-buttons">
        <button className="menu-btn menu-btn-primary" onClick={onStartBot}>
          Bota Karşı
        </button>
        <button className="menu-btn menu-btn-secondary" onClick={onCreateRoom}>
          Arkadaşla Oyna
        </button>
        <button className="menu-btn menu-btn-secondary" onClick={onJoinQueue}>
          Rastgele Eşleş
        </button>
      </div>
    </div>
  );
}
