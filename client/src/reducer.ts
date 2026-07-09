import type {
  Card,
  Hand,
  PenaltyExchangeResultPayload,
  RoundResult,
  Task,
} from '@fkd/shared';
import { type ClientState, initialClientState } from './types.js';

export type Action =
  | { type: 'RESET' }
  | { type: 'LOBBY_CREATING' }
  | { type: 'LOBBY_JOINING' }
  | { type: 'LOBBY_QUEUE' }
  | { type: 'ROOM_CREATED'; roomId: string }
  | { type: 'QUEUE_WAITING' }
  | { type: 'MATCH_START'; matchId: string; playerIdx: 0 | 1 }
  | { type: 'RESTORE_SESSION'; matchId: string; playerIdx: 0 | 1 }
  | { type: 'OPPONENT_DISCONNECTED'; graceMs: number }
  | { type: 'OPPONENT_RECONNECTED' }
  | { type: 'REMATCH_LOCAL' }
  | { type: 'MATCH_REMATCH_REQUESTED' }
  | { type: 'DRAFT_OPTIONS'; round: number; totalRounds: number; isGkRound: boolean; options: Card[] }
  | { type: 'DRAFT_PICK_LOCAL'; cardId: string }
  | { type: 'DRAFT_OPPONENT_PICKED'; round: number }
  | { type: 'DRAFT_COMPLETE'; hand: Hand }
  | { type: 'ROUND_TASK'; round: number; totalRounds: number; task: Task }
  | { type: 'CLEAR_KEEPER_BANNER' }
  | { type: 'ROUND_PLAY_LOCAL'; cardId: string }
  | { type: 'ROUND_WAITING_OPPONENT' }
  | { type: 'ROUND_REVEAL'; result: RoundResult }
  | { type: 'MATCH_SCORE'; scores: [number, number] }
  | { type: 'KEEPER_ROUND_START'; round: number; task: Task; keepers: [Card, Card] }
  | {
      type: 'PENALTY_START';
      availableShooterIds: string[];
      totalGoals: [number, number];
      exchangeIndex: number;
      pendingCardId: string | null;
      opponentPicked: boolean;
    }
  | { type: 'PENALTY_PICK_LOCAL'; cardId: string }
  | { type: 'PENALTY_OPPONENT_PICKED' }
  | { type: 'PENALTY_RESULT'; result: PenaltyExchangeResultPayload }
  | {
      type: 'MATCH_END';
      winner: 0 | 1;
      decidedBy: 'score' | 'penalty' | 'forfeit';
      finalScores: [number, number];
      history: RoundResult[];
      penalty: { goals: [number, number]; decidedBy: 'goals' | 'stats' | 'coin' } | null;
    }
  | { type: 'ERROR'; message: string };

export function reducer(state: ClientState, action: Action): ClientState {
  switch (action.type) {
    case 'RESET':
      return initialClientState;

    case 'LOBBY_CREATING':
      return { ...initialClientState, screen: 'lobby', lobby: { mode: 'creating', roomId: null } };

    case 'LOBBY_JOINING':
      return { ...initialClientState, screen: 'lobby', lobby: { mode: 'joining', roomId: null } };

    case 'LOBBY_QUEUE':
      return { ...initialClientState, screen: 'lobby', lobby: { mode: 'queue', roomId: null } };

    case 'ROOM_CREATED':
      return state.lobby ? { ...state, lobby: { ...state.lobby, roomId: action.roomId } } : state;

    case 'QUEUE_WAITING':
      return state.lobby ? { ...state, lobby: { ...state.lobby, mode: 'queue' } } : state;

    case 'MATCH_START':
      return { ...initialClientState, matchId: action.matchId, myIdx: action.playerIdx, screen: 'draft' };

    case 'RESTORE_SESSION':
      return { ...state, matchId: action.matchId, myIdx: action.playerIdx };

    case 'OPPONENT_DISCONNECTED':
      return { ...state, opponentDisconnected: { graceMs: action.graceMs } };

    case 'OPPONENT_RECONNECTED':
      return { ...state, opponentDisconnected: null };

    case 'REMATCH_LOCAL':
      return state.end ? { ...state, end: { ...state.end, rematchRequestedByMe: true } } : state;

    case 'MATCH_REMATCH_REQUESTED':
      return state.end ? { ...state, end: { ...state.end, rematchRequestedByOpponent: true } } : state;

    case 'DRAFT_OPTIONS':
      return {
        ...state,
        screen: 'draft',
        draft: {
          round: action.round,
          totalRounds: action.totalRounds,
          isGkRound: action.isGkRound,
          options: action.options,
          myPickId: null,
          opponentPicked: false,
        },
      };

    case 'DRAFT_PICK_LOCAL':
      return state.draft ? { ...state, draft: { ...state.draft, myPickId: action.cardId } } : state;

    case 'DRAFT_OPPONENT_PICKED':
      return state.draft ? { ...state, draft: { ...state.draft, opponentPicked: true } } : state;

    case 'DRAFT_COMPLETE':
      return {
        ...state,
        draft: null,
        match: {
          round: 0,
          totalRounds: 5,
          task: null,
          scores: [0, 0],
          hand: action.hand,
          usedCardIds: [],
          myPickId: null,
          waitingOpponent: false,
          lastReveal: null,
          history: [],
        },
      };

    case 'ROUND_TASK': {
      const keeperReveal = state.keeperRound?.reveal ?? null;
      const other = state.myIdx === 0 ? 1 : 0;
      const keeperBanner = keeperReveal
        ? keeperReveal.winner === state.myIdx
          ? `Kilit Round: Kalecin kazandı! (+${keeperReveal.points[state.myIdx]})`
          : keeperReveal.winner === other
            ? `Kilit Round: Rakip kaleci kazandı. (+${keeperReveal.points[other]})`
            : 'Kilit Round: Berabere! (+1 / +1)'
        : state.keeperBanner;
      return {
        ...state,
        screen: 'match',
        keeperRound: null,
        keeperBanner,
        match: state.match
          ? {
              ...state.match,
              round: action.round,
              totalRounds: action.totalRounds,
              task: action.task,
              myPickId: null,
              waitingOpponent: false,
              lastReveal: null,
            }
          : null,
      };
    }

    case 'CLEAR_KEEPER_BANNER':
      return { ...state, keeperBanner: null };

    case 'ROUND_PLAY_LOCAL':
      return state.match ? { ...state, match: { ...state.match, myPickId: action.cardId } } : state;

    case 'ROUND_WAITING_OPPONENT':
      return state.match ? { ...state, match: { ...state.match, waitingOpponent: true } } : state;

    case 'ROUND_REVEAL':
      return state.match
        ? {
            ...state,
            match: {
              ...state.match,
              lastReveal: action.result,
              usedCardIds: [...state.match.usedCardIds, action.result.cards[state.myIdx].id],
              history: [...state.match.history, action.result],
            },
            keeperRound: state.keeperRound ? { ...state.keeperRound, reveal: action.result } : state.keeperRound,
          }
        : state;

    case 'MATCH_SCORE':
      return state.match ? { ...state, match: { ...state.match, scores: action.scores } } : state;

    case 'KEEPER_ROUND_START':
      return {
        ...state,
        screen: 'keeperRound',
        keeperRound: { round: action.round, task: action.task, keepers: action.keepers, reveal: null },
      };

    case 'PENALTY_START':
      // Seri durumu (skor, seri no, kilitli seçim) artık sunucudan gelir — sayfa
      // yenileme/reconnect'te de doğru resync olur (eskiden 0-0 / "İlk Seri"ye dönüyordu).
      // lastResult burada temizlenir; korumak yeni seride kart seçimini kilitlerdi
      // (bkz. docs/faz4-duzeltme-plani.md Sorun 2).
      return {
        ...state,
        screen: 'penalty',
        keeperRound: null,
        penalty: {
          availableShooterIds: action.availableShooterIds,
          myPickId: action.pendingCardId,
          opponentPicked: action.opponentPicked,
          totalGoals: action.totalGoals,
          lastResult: null,
          currentExchangeIndex: action.exchangeIndex,
        },
      };

    case 'PENALTY_PICK_LOCAL':
      return state.penalty ? { ...state, penalty: { ...state.penalty, myPickId: action.cardId } } : state;

    case 'PENALTY_OPPONENT_PICKED':
      return state.penalty ? { ...state, penalty: { ...state.penalty, opponentPicked: true } } : state;

    case 'PENALTY_RESULT':
      return state.penalty
        ? {
            ...state,
            penalty: { ...state.penalty, lastResult: action.result, totalGoals: action.result.totalGoals },
          }
        : state;

    case 'MATCH_END':
      return {
        ...state,
        screen: 'end',
        opponentDisconnected: null,
        end: {
          winner: action.winner,
          decidedBy: action.decidedBy,
          finalScores: action.finalScores,
          history: action.history,
          penalty: action.penalty,
          rematchRequestedByMe: false,
          rematchRequestedByOpponent: false,
        },
      };

    case 'ERROR':
      return { ...state, error: action.message };

    default:
      return state;
  }
}
