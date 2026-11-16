import { afterEach, expect, it, vi } from 'vitest';
import { initialGame, positionKey, outcome } from './engine';
import { loadGame, saveGame, validateSaved } from './storage';
afterEach(() => vi.unstubAllGlobals());
it('valida una partida y rechaza datos corruptos o incompatibles', () => {
  const s = { version: 2, game: initialGame(), from: null, path: [] };
  expect(validateSaved(s)).toBe(true);
  expect(validateSaved({ ...s, version: 3 })).toBe(false);
  expect(validateSaved({ ...s, path: [18] })).toBe(false);
  expect(validateSaved({ ...s, game: { ...s.game, board: [] } })).toBe(false);
  expect(validateSaved({ ...s, game: { ...s.game, positions: ['bad'] } })).toBe(false);
});
it('guarda y recupera una partida', () => {
  let raw: string | null = null;
  vi.stubGlobal('localStorage', { setItem: (_: string, v: string) => { raw = v; }, getItem: () => raw });
  const s = { version: 2 as const, game: initialGame(), from: 41, path: [] };
  expect(saveGame(s)).toBe(true); expect(loadGame().saved).toEqual(s);
});
it('recupera una captura a medio completar', () => {
  const board = Array(64).fill(null);
  board[54] = { color: 'black', king: false }; board[45] = board[27] = { color: 'white', king: false };
  const game = { board, turn: 'black' as const, positions: [positionKey(board, 'black')] };
  expect(validateSaved({ version: 2, game, from: 54, path: [36] })).toBe(true);
  expect(validateSaved({ version: 2, game, from: 54, path: [18] })).toBe(false);
});
it('tolera almacenamiento bloqueado sin romper el juego', () => {
  vi.stubGlobal('localStorage', { getItem: () => { throw Error(); }, setItem: () => { throw Error(); } });
  expect(loadGame().warning).toBeTruthy();
  expect(saveGame({ version: 2, game: initialGame(), from: null, path: [] })).toBe(false);
});

it('migra v1 sin cambiar propietarios ni orientación y no vuelve a invertir al restaurar v2', () => {
  const board = Array(64).fill(null); board[54] = { color: 'white', king: false };
  board[45] = { color: 'black', king: true }; board[27] = { color: 'black', king: false };
  let raw = JSON.stringify({ version: 1, game: { board, turn: 'white', positions: [positionKey(board, 'white')] },
    from: 54, path: [36], captured: [{ color: 'black', king: true }] });
  vi.stubGlobal('localStorage', { getItem: () => raw, setItem: (_k: string, value: string) => { raw = value; } });
  const migrated = loadGame(); expect(migrated.warning).toBe(''); expect(migrated.saved.version).toBe(2);
  expect(migrated.saved.game.turn).toBe('black'); expect(migrated.saved.game.board[54]?.color).toBe('black');
  expect(migrated.saved.game.board[45]).toEqual({ color: 'white', king: true });
  expect(migrated.saved.captured).toEqual([{ color: 'white', king: true }]);
  expect(migrated.saved.path).toEqual([36]); expect(validateSaved(migrated.saved)).toBe(true);
  saveGame(migrated.saved); expect(loadGame().saved).toEqual(migrated.saved);
});
it('migra también el turno antiguo de la máquina y conserva las repeticiones', () => {
  const board = Array(64).fill(null); board[54] = { color: 'white', king: true }; board[18] = { color: 'black', king: true };
  const position = positionKey(board, 'black');
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ version: 1, game: { board, turn: 'black', positions: [position, position, position] }, from: null, path: [] }) });
  const saved = loadGame().saved;
  expect(saved.game.turn).toBe('white'); expect(saved.game.board[18]?.color).toBe('white');
  expect(saved.game.positions).toEqual(Array(3).fill(positionKey(saved.game.board, 'white')));
});

it('una victoria blanca antigua se restaura como victoria del humano negro', () => {
  const board = Array(64).fill(null); board[0] = {color:'white',king:true};
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({version:1,game:{board,turn:'black',positions:[positionKey(board,'black')]},from:null,path:[]})});
  const loaded=loadGame(); expect(loaded.warning).toBe(''); expect(outcome(loaded.saved.game)).toEqual({winner:'black'});
});
