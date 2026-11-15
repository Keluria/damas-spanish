import { afterEach, expect, it, vi } from 'vitest';
import { initialGame, positionKey } from './engine';
import { loadGame, saveGame, validateSaved } from './storage';
afterEach(() => vi.unstubAllGlobals());
it('valida una partida y rechaza datos corruptos o incompatibles', () => {
  const s = { version: 1, game: initialGame(), from: null, path: [] };
  expect(validateSaved(s)).toBe(true);
  expect(validateSaved({ ...s, version: 2 })).toBe(false);
  expect(validateSaved({ ...s, path: [18] })).toBe(false);
  expect(validateSaved({ ...s, game: { ...s.game, board: [] } })).toBe(false);
  expect(validateSaved({ ...s, game: { ...s.game, positions: ['bad'] } })).toBe(false);
});
it('guarda y recupera una partida', () => {
  let raw: string | null = null;
  vi.stubGlobal('localStorage', { setItem: (_: string, v: string) => { raw = v; }, getItem: () => raw });
  const s = { version: 1 as const, game: initialGame(), from: 41, path: [] };
  expect(saveGame(s)).toBe(true); expect(loadGame().saved).toEqual(s);
});
it('recupera una captura a medio completar', () => {
  const board = Array(64).fill(null);
  board[54] = { color: 'white', king: false }; board[45] = board[27] = { color: 'black', king: false };
  const game = { board, turn: 'white' as const, positions: [positionKey(board, 'white')] };
  expect(validateSaved({ version: 1, game, from: 54, path: [36] })).toBe(true);
  expect(validateSaved({ version: 1, game, from: 54, path: [18] })).toBe(false);
});
it('tolera almacenamiento bloqueado sin romper el juego', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
  expect(loadGame().warning).toBeTruthy();
  expect(saveGame({ version: 1, game: initialGame(), from: null, path: [] })).toBe(false);
});
