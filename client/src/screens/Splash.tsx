import { motion } from 'framer-motion';

interface Props {
  /** Bağlantı 10 sn'i aştı — kullanıcıya soğuk başlangıç notu göster. */
  slow: boolean;
}

/**
 * Soğuk başlangıç ekranı (#24): uygulama açılır açılmaz gösterilir; socket
 * bağlantısı kurulana ve minimum gösterim süresi geçene kadar ekranı kaplar.
 * Ücretsiz sunucu (Railway) uykudan uyanırken 20-60 sn sürebildiği için
 * uzayan beklemede açıklama notu çıkar. Kaldırılışı App'teki AnimatePresence
 * ile yumuşak biter.
 */
export function Splash({ slow }: Props) {
  return (
    <motion.div className="splash" exit={{ opacity: 0, transition: { duration: 0.45 } }}>
      <div className="splash-crest" aria-hidden>
        FKD
      </div>
      <h1 className="splash-title">Futbol Kart Düellosu</h1>
      <div className="splash-ball-area" aria-hidden>
        <div className="splash-ball" />
        <div className="splash-ball-shadow" />
      </div>
      <p className="splash-status" role="status">
        {slow ? 'Sunucu uyanıyor — ilk açılış biraz sürebilir…' : 'Bağlanılıyor…'}
      </p>
    </motion.div>
  );
}
