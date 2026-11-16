import { afterEach, expect, it, vi } from 'vitest';
import { positionKey, type Board } from './engine';
import { candidates, tapSquare } from './interaction';
import { loadGame, saveGame, type SavedGame } from './storage';
function chain(): SavedGame {
  const board: Board = Array(64).fill(null);
  board[54] = board[50] = { color: 'black', king: false };
  board[45] = board[27] = { color: 'white', king: false };
  return { version: 2, game: { board, turn: 'black', positions: [positionKey(board, 'black')] }, from: null, path: [] };
}
const firstJump = () => tapSquare(tapSquare(chain(), 54), 36);
afterEach(() => vi.unstubAllGlobals());
it('selecciona con un toque y permite un movimiento normal aunque haya capturas', () => {
  const selected = tapSquare(chain(), 50);
  expect(selected.from).toBe(50);
  const moved = tapSquare(selected, 41);
  expect(moved.game.turn).toBe('white');
  expect(moved.game.board[41]?.color).toBe('black');
  expect(moved.game.board[45]?.color).toBe('white');
});
it('ofrece continuar y permite terminar tocando la ficha que acaba de saltar', () => {
  const partial = firstJump();
  expect(partial.game.turn).toBe('black'); expect(partial.path).toEqual([36]);
  expect(candidates(partial).some(m => m.path[1] === 18)).toBe(true);
  const stopped = tapSquare(partial, 36);
  expect(stopped.game.turn).toBe('white'); expect(stopped.path).toEqual([]);
  expect(stopped.game.board[36]?.color).toBe('black');
  expect(stopped.game.board[45]).toBeNull(); expect(stopped.game.board[27]?.color).toBe('white');
});
it('permite continuar y termina automáticamente si no hay más saltos', () => {
  const complete = tapSquare(firstJump(), 18);
  expect(complete.game.turn).toBe('white');
  expect(complete.game.board[18]?.color).toBe('black');
  expect(complete.game.board[45]).toBeNull(); expect(complete.game.board[27]).toBeNull();
  expect(complete.from).toBeNull(); expect(complete.path).toEqual([]);
});
it('no cambia de ficha ni hace un movimiento normal durante una cadena', () => {
  const partial = firstJump();
  expect(tapSquare(partial, 50)).toBe(partial);
  expect(tapSquare(partial, 29)).toBe(partial);
});
it('antes de saltar permite cambiar de ficha o cancelar la selección', () => {
  const selected = tapSquare(chain(), 54);
  expect(tapSquare(selected, 50).from).toBe(50);
  expect(tapSquare(selected, 54).from).toBeNull();
});
it('al reabrir recupera la captura en curso y permite terminarla voluntariamente', () => {
  let raw: string | null = null;
  vi.stubGlobal('localStorage', { setItem: (_: string, v: string) => { raw = v; }, getItem: () => raw });
  expect(saveGame(firstJump())).toBe(true);
  const restored = loadGame();
  expect(restored.warning).toBe(''); expect(restored.saved.path).toEqual([36]);
  const stopped = tapSquare(restored.saved, 36);
  expect(stopped.game.turn).toBe('white');
  saveGame(stopped);
  expect(loadGame().saved).toEqual(stopped);
});
it('rechaza casillas ocupadas y posiciones que no son destinos legales', () => {
  const selected = tapSquare(chain(), 54);
  expect(tapSquare(selected, 45)).toBe(selected);
  expect(tapSquare(selected, 53)).toBe(selected);
});
