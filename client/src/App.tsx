import { useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { socket } from './socket.js';
import { reducer } from './reducer.js';
import { initialClientState } from './types.js';
import { MainMenu } from './screens/MainMenu.js';
import { Lobby } from './screens/Lobby.js';
import { Draft } from './screens/Draft.js';
import { MatchScreen } from './screens/MatchScreen.js';
import { KeeperRound } from './screens/KeeperRound.js';
import { Penalty } from './screens/Penalty.js';
import { MatchEnd } from './screens/MatchEnd.js';
import { Splash } from './screens/Splash.js';

const STORAGE_KEY = 'fkd:match';

interface StoredMatch {
  matchId: string;
  playerToken: string;
  playerIdx: 0 | 1;
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, initialClientState);
  const reconnecting = useRef(false);
  const mountEffectRan = useRef(false);
  const reduceMotion = useReducedMotion();

  // Soğuk başlangıç splash'i (#24): bağlantı kurulana VE min süre geçene kadar görünür.
  const [connected, setConnected] = useState(socket.connected);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [slowServer, setSlowServer] = useState(false);
  const showSplash = !(connected && minSplashDone);

  useEffect(() => {
    const minTimer = setTimeout(() => setMinSplashDone(true), 1500);
    const slowTimer = setTimeout(() => setSlowServer(true), 10_000);
    return () => {
      clearTimeout(minTimer);
      clearTimeout(slowTimer);
    };
  }, []);

  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    // Yarış durumu: socket modül yüklenirken bağlanmaya başlar; listener kayıt
    // olmadan önce bağlantı kurulduysa 'connect' bir daha tetiklenmez.
    if (socket.connected) setConnected(true);
    socket.on('room:created', ({ roomId }) => dispatch({ type: 'ROOM_CREATED', roomId }));
    socket.on('queue:waiting', () => dispatch({ type: 'QUEUE_WAITING' }));
    socket.on('match:start', ({ matchId, playerToken, playerIdx }) => {
      // Bot maçı dahil tüm maçları sakla ki sayfa yenilemede reconnect edilebilsin.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ matchId, playerToken, playerIdx } satisfies StoredMatch));
      reconnecting.current = false;
      dispatch({ type: 'MATCH_START', matchId, playerIdx });
    });
    socket.on('draft:options', (payload) => dispatch({ type: 'DRAFT_OPTIONS', ...payload }));
    socket.on('draft:opponentPicked', ({ round }) => dispatch({ type: 'DRAFT_OPPONENT_PICKED', round }));
    socket.on('draft:complete', ({ hand }) => dispatch({ type: 'DRAFT_COMPLETE', hand }));
    socket.on('round:task', (payload) => dispatch({ type: 'ROUND_TASK', ...payload }));
    socket.on('round:waitingOpponent', () => dispatch({ type: 'ROUND_WAITING_OPPONENT' }));
    socket.on('round:reveal', (result) => dispatch({ type: 'ROUND_REVEAL', result }));
    socket.on('match:score', ({ scores }) => dispatch({ type: 'MATCH_SCORE', scores }));
    socket.on('keeperRound:start', (payload) => dispatch({ type: 'KEEPER_ROUND_START', ...payload }));
    socket.on('penalty:start', (payload) => dispatch({ type: 'PENALTY_START', ...payload }));
    socket.on('penalty:opponentPicked', () => dispatch({ type: 'PENALTY_OPPONENT_PICKED' }));
    socket.on('penalty:result', (result) => dispatch({ type: 'PENALTY_RESULT', result }));
    socket.on('match:rematchRequested', () => dispatch({ type: 'MATCH_REMATCH_REQUESTED' }));
    socket.on('opponent:disconnected', ({ graceMs }) => dispatch({ type: 'OPPONENT_DISCONNECTED', graceMs }));
    socket.on('opponent:reconnected', () => dispatch({ type: 'OPPONENT_RECONNECTED' }));
    socket.on('match:end', (payload) => {
      localStorage.removeItem(STORAGE_KEY);
      dispatch({ type: 'MATCH_END', ...payload });
    });
    socket.on('error', ({ message }) => {
      if (reconnecting.current) {
        localStorage.removeItem(STORAGE_KEY);
        reconnecting.current = false;
      }
      dispatch({ type: 'ERROR', message });
    });

    return () => {
      socket.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    if (mountEffectRan.current) return;
    mountEffectRan.current = true;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { matchId, playerToken, playerIdx } = JSON.parse(saved) as StoredMatch;
        reconnecting.current = true;
        dispatch({ type: 'RESTORE_SESSION', matchId, playerIdx });
        socket.emit('match:reconnect', { matchId, playerToken });
        return;
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    const roomId = new URLSearchParams(window.location.search).get('room');
    if (roomId) {
      dispatch({ type: 'LOBBY_JOINING' });
      socket.emit('room:join', { roomId });
    }
  }, []);

  return (
    <div className="app">
      <AnimatePresence>{showSplash && <Splash slow={slowServer && !connected} />}</AnimatePresence>
      {createPortal(
        <div className="banner-stack">
          {state.error && <div className="error-banner">{state.error}</div>}
          {state.opponentDisconnected && (
            <div className="error-banner">
              Rakip bağlantısı koptu — {Math.round(state.opponentDisconnected.graceMs / 1000)} sn içinde dönmezse maçı
              kazanacaksın.
            </div>
          )}
        </div>,
        document.body
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={state.screen}
          initial={reduceMotion ? false : { clipPath: 'inset(0 100% 0 0)', opacity: 0.6, x: 12 }}
          animate={{ clipPath: 'inset(0 0% 0 0)', opacity: 1, x: 0 }}
          exit={
            reduceMotion
              ? { opacity: 0 }
              : { clipPath: 'inset(0 0 0 100%)', opacity: 0.6, x: -12 }
          }
          transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {state.screen === 'menu' && (
            <MainMenu
              onStartBot={() => {
                socket.emit('bot:start');
              }}
              onCreateRoom={() => {
                dispatch({ type: 'LOBBY_CREATING' });
                socket.emit('room:create');
              }}
              onJoinQueue={() => {
                dispatch({ type: 'LOBBY_QUEUE' });
                socket.emit('queue:join');
              }}
            />
          )}
          {state.screen === 'lobby' && state.lobby && <Lobby state={state.lobby} />}
          {state.screen === 'draft' && state.draft && (
            <Draft
              state={state.draft}
              onPick={(cardId) => {
                dispatch({ type: 'DRAFT_PICK_LOCAL', cardId });
                socket.emit('draft:pick', { cardId });
              }}
            />
          )}
          {state.screen === 'match' && state.match && (
            <MatchScreen
              state={state.match}
              myIdx={state.myIdx}
              banner={state.keeperBanner}
              onBannerDone={() => dispatch({ type: 'CLEAR_KEEPER_BANNER' })}
              onPlay={(cardId) => {
                dispatch({ type: 'ROUND_PLAY_LOCAL', cardId });
                socket.emit('round:playCard', { cardId });
              }}
            />
          )}
          {state.screen === 'keeperRound' && state.keeperRound && (
            <KeeperRound state={state.keeperRound} myIdx={state.myIdx} />
          )}
          {state.screen === 'penalty' && state.penalty && state.match && (
            <Penalty
              state={state.penalty}
              hand={state.match.hand}
              myIdx={state.myIdx}
              onPick={(cardId) => {
                dispatch({ type: 'PENALTY_PICK_LOCAL', cardId });
                socket.emit('penalty:pickShooter', { cardId });
              }}
            />
          )}
          {state.screen === 'end' && state.end && (
            <MatchEnd
              state={state.end}
              myIdx={state.myIdx}
              onRematch={() => {
                dispatch({ type: 'REMATCH_LOCAL' });
                socket.emit('match:rematch');
              }}
              onMenu={() => dispatch({ type: 'RESET' })}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
