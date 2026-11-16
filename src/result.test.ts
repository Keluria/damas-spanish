import { afterEach, expect, it, vi } from 'vitest';
import { resultScreen } from './result';
import { animatedInput, type Cleanup } from './animation';
import { initialGame, positionKey, type Board, type Color, type Game, type Piece } from './engine';
import { ipadOpponent } from './opponent';
import { loadGame, saveGame, type SavedGame } from './storage';

const black: Piece = { color: 'black', king: false };
const white: Piece = { color: 'white', king: false };
function game(pieces: Record<number, Piece>, turn: Color): Game {
  const board: Board = Array(64).fill(null);
  for (const [square, piece] of Object.entries(pieces)) board[Number(square)] = piece;
  return { board, turn, positions: [positionKey(board, turn)] };
}
function view() {
  const show = vi.fn(), hide = vi.fn();
  return { show, hide, screen: resultScreen({ show, hide }) };
}
afterEach(() => vi.unstubAllGlobals());

it('muestra la victoria humana por falta de fichas, con felicitación y celebración', () => {
  const v = view(); v.screen.update(game({ 36: black }, 'white'));
  expect(v.show).toHaveBeenCalledExactlyOnceWith({ title: '¡Has ganado!', message: '¡Muy bien jugado!', celebrate: true });
  expect(v.screen.finished).toBe(true);
});
it('detecta también la victoria humana por bloqueo usando el motor', () => {
  const v = view(); v.screen.update(game({ 63: white, 36: black }, 'white'));
  expect(v.show.mock.calls[0][0].title).toBe('¡Has ganado!');
});
it.each([
  game({ 18: white }, 'black'),
  game({ 0: black, 18: white }, 'black')
])('muestra una derrota amable sin celebración por falta de fichas o movimientos', state => {
  const v = view(); v.screen.update(state);
  expect(v.show).toHaveBeenCalledExactlyOnceWith({ title: 'Partida terminada', message: 'Gracias por jugar. Podemos intentarlo otra vez.', celebrate: false });
});
it('muestra las tablas por la repetición ya implementada, sin celebración', () => {
  const state = game({ 0: { ...black, king: true }, 63: { ...white, king: true } }, 'black');
  state.positions = Array(3).fill(positionKey(state.board, state.turn));
  const v = view(); v.screen.update(state);
  expect(v.show).toHaveBeenCalledExactlyOnceWith({ title: '¡Tablas! Buena partida', message: '', celebrate: false });
});
it('una partida en curso no muestra resultados ni habilita el reinicio directo', () => {
  const v = view(); v.screen.update(initialGame());
  expect(v.screen.finished).toBe(false); expect(v.show).not.toHaveBeenCalled();
});
it('aplaza el resultado hasta que finaliza la animación', () => {
  const v = view(), state = game({ 36: black }, 'white');
  v.screen.update(state, true);
  expect(v.show).not.toHaveBeenCalled(); expect(v.screen.finished).toBe(false);
  v.screen.update(state, false);
  expect(v.show).toHaveBeenCalledTimes(1);
});
it('no vuelve a mostrar ni celebrar el resultado en actualizaciones repetidas', () => {
  const v = view(), state = game({ 36: black }, 'white');
  for (let i = 0; i < 10; i++) v.screen.update(state);
  expect(v.show).toHaveBeenCalledTimes(1);
});
it('restaura una partida terminada y muestra el resultado sin repetir la celebración', () => {
  let raw: string | null = null;
  vi.stubGlobal('localStorage', { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } });
  saveGame({ version: 2, game: game({ 36: black }, 'white'), from: null, path: [] });
  const loaded = loadGame(), v = view();
  expect(loaded.warning).toBe('');
  v.screen.update(loaded.saved.game, false, true);
  v.screen.update(loaded.saved.game);
  expect(v.show).toHaveBeenCalledExactlyOnceWith({ title: '¡Has ganado!', message: '¡Muy bien jugado!', celebrate: false });
});
it('reinicia una partida terminada, oculta el resultado y permite otra celebración futura', () => {
  let saved: SavedGame = { version: 2, game: game({ 36: black }, 'white'), from: null, path: [] };
  const v = view(); v.screen.update(saved.game);
  const opponent = ipadOpponent({
    current: () => saved, busy: () => false, tap: async () => {},
    replace: next => { saved = next; v.screen.update(saved.game); }
  });
  expect(opponent.newGame()).toBe(true);
  expect(saved.game).toEqual(initialGame());
  expect(v.screen.finished).toBe(false); expect(v.hide).toHaveBeenCalledTimes(1);
  v.screen.update(game({ 36: black }, 'white'));
  expect(v.show).toHaveBeenCalledTimes(2);
});
it('no altera el estado ni el historial del motor al presentar un resultado', () => {
  const state = game({ 36: black }, 'white'), before = JSON.stringify(state);
  const v = view(); v.screen.update(state);
  expect(JSON.stringify(state)).toBe(before);
});
it('integra el último salto: guarda primero y muestra el resultado después de limpiar la animación', async () => {
  let saved: SavedGame = { version: 2, game: game({ 36: black, 27: white }, 'black'), from: 36, path: [] };
  let moving = false, land!: (cleanup: Cleanup) => void;
  const timeline: string[] = [];
  const show = vi.fn(() => { timeline.push('result'); });
  const screen = resultScreen({ show, hide: vi.fn() });
  const persist = vi.fn();
  const input = animatedInput({
    current: () => saved, persist,
    animate: () => new Promise<Cleanup>(resolve => { land = resolve; }),
    present: next => { saved = next; screen.update(saved.game, moving); timeline.push('landing'); },
    setBusy: busy => { moving = busy; if (!busy) screen.update(saved.game); }
  });
  const pending = input.tap(18);
  expect(persist).toHaveBeenCalledTimes(1); expect(show).not.toHaveBeenCalled();
  expect(screen.finished).toBe(false);
  land(() => { timeline.push('cleanup'); }); await pending;
  expect(timeline).toEqual(['landing', 'cleanup', 'result']);
  expect(show).toHaveBeenCalledTimes(1); expect(screen.finished).toBe(true);
});
