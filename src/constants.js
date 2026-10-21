export const MATCH_STATUS = {
  SYNCING: 'syncing',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  PAUSED: 'paused',
  FINISHED: 'finished',
};

export const MATCH_RESULT = {
  RED_WIN: 'red-win',
  BLACK_WIN: 'black-win',
  DRAW: 'draw',
  VOIDED: 'voided',
};

export const MATCH_REASON = {
  CHECKMATE: 'checkmate',
  NO_LEGAL_MOVES: 'no-legal-moves',
  TIMEOUT: 'timeout',
  LEFT_MATCH: 'left-match',
  DISCONNECT_TIMEOUT: 'disconnect-timeout',
  SURRENDER: 'surrender',
  DRAW_AGREED: 'draw-agreed',
  SYSTEM_ERROR: 'system-error',
};
