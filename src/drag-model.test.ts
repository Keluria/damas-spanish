import { expect, it, vi } from 'vitest';
import { dragPlan, commitDrag, crossedDragThreshold } from './drag-model';
import { initialGame, positionKey, applyMove, type Board, type Game } from './engine';
import { tapSquare } from './interaction';
import { animatedInput } from './animation';
import type { SavedGame } from './storage';
function saved(game: Game = initialGame()): SavedGame { return { version: 2, game, from: null, path: [] }; }
function chain(): SavedGame {
  const board: Board = Array(64).fill(null);
  board[54] = { color: 'black', king: false };
  board[45] = board[27] = { color: 'white', king: false };
  return saved({ board, turn: 'black', positions: [positionKey(board, 'black')] });
}
it('un pequeño temblor sigue siendo una pulsación', () => {
  expect(crossedDragThreshold(3, 4)).toBe(false);
  expect(crossedDragThreshold(8, 0)).toBe(true);
  expect(crossedDragThreshold(-6, -6)).toBe(true);
});
it('la selección de arrastre es solo una previsualización y usa los destinos legales', () => {
  const state = saved(), original = JSON.stringify(state);
  expect(dragPlan(state, 41)?.destinations).toEqual([32, 34]);
  expect(dragPlan(state, 41)?.selection.from).toBe(41);
  expect(JSON.stringify(state)).toBe(original);
  expect(dragPlan(state, 16)).toBeNull();
});
it('no permite arrastrar durante el turno negro ni con la partida terminada', () => {
  const state = saved(); state.game.turn = 'white';
  expect(dragPlan(state, 16)).toBeNull();
  const end = chain(); end.game.board[54] = null;
  expect(dragPlan(end, 45)).toBeNull();
});
it('un destino ilegal o la casilla de origen no ejecuta nada ni cambia la selección', async () => {
  const state = { ...saved(), from: 43 }, original = JSON.stringify(state), tap = vi.fn();
  expect(await commitDrag(state, 41, 40, tap)).toBe(false);
  expect(await commitDrag(state, 41, 41, tap)).toBe(false);
  expect(tap).not.toHaveBeenCalled(); expect(JSON.stringify(state)).toBe(original);
});
it('una suelta válida selecciona una vez y pide confirmar sin repetir la animación', async () => {
  const tap = vi.fn(async () => {});
  expect(await commitDrag(saved(), 41, 32, tap)).toBe(true);
  expect(tap.mock.calls).toEqual([[41], [32, { animate: false }]]);
});
it('no deselecciona una ficha que ya estaba seleccionada', async () => {
  const tap = vi.fn(async () => {});
  await commitDrag({ ...saved(), from: 41 }, 41, 32, tap);
  expect(tap.mock.calls).toEqual([[32, { animate: false }]]);
});
it('permite continuar una captura desde la casilla visible y mantiene la parada voluntaria', async () => {
  let state = tapSquare(tapSquare(chain(), 54), 36);
  expect(dragPlan(state, 36)?.destinations).toEqual([18]);
  expect(dragPlan(state, 54)).toBeNull();
  const tap = vi.fn(async (square: number) => { state = tapSquare(state, square); });
  await commitDrag(state, 36, 18, tap);
  expect(state.game.board[18]?.color).toBe('black'); expect(state.game.board[27]).toBeNull();
  const stopped = tapSquare(tapSquare(tapSquare(chain(), 54), 36), 36);
  expect(stopped.game.turn).toBe('white'); expect(stopped.game.board[27]?.color).toBe('white');
});
it('integra el motor, el guardado único y la animación omitida de una suelta', async () => {
  let state = saved(); const animate = vi.fn(async () => {}), persist = vi.fn();
  const input = animatedInput({ current: () => state, persist,
    present: next => { state = next; }, animate, setBusy: vi.fn() });
  await commitDrag(state, 41, 32, input.tap);
  expect(state.game).toEqual(applyMove(initialGame(), { from: 41, path: [32], captures: [] }));
  expect(persist).toHaveBeenCalledTimes(2); // Selection, then one complete turn, as with taps.
  expect(animate).not.toHaveBeenCalled();
});
