import { positionKey, type Board, type Move } from '../src/engine';
import type { SavedGame } from '../src/storage';

// e4 captures the last black piece on d5 and lands on c6.
export const winningCapture: Move = { from: 36, path: [18], captures: [27] };
export function createVictoryScenario(): SavedGame {
  const board: Board = Array(64).fill(null);
  board[36] = { color: 'white', king: false };
  board[27] = { color: 'black', king: false };
  return {
    version: 1,
    game: { board, turn: 'white', positions: [positionKey(board, 'white')] },
    from: null,
    path: []
  };
}
