import { positionKey, type Board, type Move } from '../src/engine';
import type { SavedGame } from '../src/storage';

// e4 captures the last white piece on d5 and lands on c6.
export const winningCapture: Move = { from: 36, path: [18], captures: [27] };
export function createVictoryScenario(): SavedGame {
  const board: Board = Array(64).fill(null);
  board[36] = { color: 'black', king: false };
  board[27] = { color: 'white', king: false };
  return {
    version: 2,
    game: { board, turn: 'black', positions: [positionKey(board, 'black')] },
    from: null,
    path: []
  };
}
