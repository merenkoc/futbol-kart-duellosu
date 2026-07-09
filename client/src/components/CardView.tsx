import { motion, useReducedMotion } from 'framer-motion';
import type { Card } from '@fkd/shared';
import { overall, tierOf } from '@fkd/shared';
import { gameConfig, statLabel } from '../gameConfig.js';

interface Props {
  card: Card;
  disabled?: boolean;
  selected?: boolean;
  used?: boolean;
  /** true iken kartın arkası gösterilir (ör. rakibin henüz açılmamış kartı). */
  faceDown?: boolean;
  /** Draft'ta seçenekler geldiğinde sırayla beliren giriş animasyonu için (0,1,2...). */
  index?: number;
  /** false ise fade/slide giriş animasyonu atlanır. */
  animateEntrance?: boolean;
  onClick?: () => void;
}

export function CardView({
  card,
  disabled,
  selected,
  used,
  faceDown = false,
  index = 0,
  animateEntrance = true,
  onClick,
}: Props) {
  const reduceMotion = useReducedMotion();
  const ov = overall(card);
  const tier = tierOf(card, gameConfig);
  const positionLabel = card.position === 'gk' ? 'KALECİ' : 'SAHA';
  const nameIsLong = card.name.length > 14;
  const classes = [
    'card',
    `tier-${tier}`,
    card.position,
    selected ? 'selected' : '',
    used ? 'used' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const entranceDelay = index * 0.06;
  return (
    <motion.button
      className={classes}
      disabled={disabled || used}
      onClick={onClick}
      initial={animateEntrance && !reduceMotion ? { opacity: 0, y: 16 } : false}
      animate={{ opacity: 1, y: 0 }}
      whileHover={!disabled && !used && !reduceMotion ? { y: -5 } : undefined}
      transition={{ delay: entranceDelay, duration: 0.25 }}
    >
      <div className="card-flip-outer">
        <motion.div
          className="card-flip-inner"
          animate={{ rotateY: faceDown ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.5 }}
        >
          <div className="card-face">
            {tier === 'ust' && <div className="card-foil" aria-hidden />}
            <div className="card-sheen" aria-hidden />
            {used && <div className="card-used-badge">OYNANDI</div>}
            <div className="card-top">
              <div className="card-badge-col">
                <div className="card-overall-badge">{ov}</div>
                <div className="card-position-label">{positionLabel}</div>
              </div>
              <div className={`card-name ${nameIsLong ? 'card-name-long' : ''}`}>{card.name}</div>
            </div>
            <ul className="card-stats">
              {Object.entries(card.stats).map(([stat, value], statIndex) => (
                <li key={stat}>
                  <div className="card-stat-row">
                    <span>{statLabel(stat)}</span>
                    <span>{value}</span>
                  </div>
                  <div className="card-stat-bar-track">
                    <motion.div
                      className="card-stat-bar-fill"
                      initial={reduceMotion ? false : { width: 0 }}
                      animate={{ width: `${(value / 99) * 100}%` }}
                      transition={{
                        delay: entranceDelay + 0.15 + statIndex * 0.06,
                        duration: 0.45,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card-back-face" aria-hidden>
            <div className="card-crest">
              <div className="card-crest-ring">
                <span className="card-crest-monogram">FKD</span>
              </div>
              <span className="card-crest-sub">FUTBOL KART DÜELLOSU</span>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.button>
  );
}
