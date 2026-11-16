import { afterEach, expect, it, vi } from 'vitest';
import { initialGame, positionKey, type Board } from './engine';
import { tapSquare } from './interaction';
import { animatedInput, type Cleanup } from './animation';
import { resultScreen } from './result';
import { ipadOpponent } from './opponent';
import { loadGame, saveGame, validateSaved, type SavedGame } from './storage';

function chain(): SavedGame {
  const board: Board = Array(64).fill(null);
  board[54] = { color: 'white', king: false };
  board[45] = { color: 'black', king: true }; board[27] = { color: 'black', king: false };
  return { version: 1, game: { board, turn: 'white', positions: [positionKey(board, 'white')] }, from: null, path: [] };
}
function memory() {
  let raw: string | null = null;
  vi.stubGlobal('localStorage', { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } });
}
afterEach(() => vi.unstubAllGlobals());

it('registra cada víctima en orden y conserva si era dama', () => {
  const original = chain();
  const first = tapSquare(tapSquare(original, 54), 36);
  expect(first.captured).toEqual([{ color: 'black', king: true }]);
  expect(first.captured![0]).not.toBe(original.game.board[45]);
  const last = tapSquare(first, 18);
  expect(last.captured).toEqual([{ color: 'black', king: true }, { color: 'black', king: false }]);
  expect(last.game.board[45]).toBeNull(); expect(last.game.board[27]).toBeNull();
  expect(original.captured).toBeUndefined();
});
it('terminar voluntariamente la cadena no duplica la primera víctima', () => {
  const first = tapSquare(tapSquare(chain(), 54), 36);
  const stopped = tapSquare(first, 36);
  expect(stopped.captured).toEqual(first.captured); expect(stopped.captured).toHaveLength(1);
});
it('un movimiento normal no añade fichas a la colección', () => {
  const game: SavedGame = { version: 1, game: initialGame(), from: null, path: [] };
  expect(tapSquare(tapSquare(game, 41), 32).captured).toBeUndefined();
});
it('acepta los guardados antiguos sin reconstruir capturas desconocidas', () => {
  const old = chain(); expect(validateSaved(old)).toBe(true);
  expect(old.captured).toBeUndefined();
});
it('rechaza colecciones corruptas o con más fichas de las posibles', () => {
  const old = chain();
  expect(validateSaved({ ...old, captured: null })).toBe(false);
  expect(validateSaved({ ...old, captured: [{ color: 'black', king: 'yes' }] })).toBe(false);
  expect(validateSaved({ ...old, captured: Array(13).fill({ color: 'black', king: false }) })).toBe(false);
});
it('recupera la colección y la casilla intermedia sin volver a capturar la misma ficha', () => {
  memory(); const first = tapSquare(tapSquare(chain(), 54), 36); saveGame(first);
  const restored = loadGame(); expect(restored.warning).toBe(''); expect(restored.saved.captured).toHaveLength(1);
  const next = tapSquare(restored.saved, 18); expect(next.captured).toHaveLength(2);
});
it('Nueva partida vacía la colección y empieza con blancas', () => {
  let saved = tapSquare(tapSquare(chain(), 54), 36);
  const opponent = ipadOpponent({ current: () => saved, busy: () => false, tap: async () => {}, replace: next => { saved = next; } });
  opponent.newGame(); expect(saved.captured).toBeUndefined(); expect(saved.game).toEqual(initialGame());
});
it('mantiene salto y traslado en secuencia, con entrada bloqueada hasta que terminan ambos', async () => {
  memory();
  let saved = { ...chain(), from: 54 }, busy = false;
  let land!: (cleanup: Cleanup) => void, collect!: (cleanup: Cleanup) => void;
  const order: string[] = [], result = resultScreen({ show: () => { order.push('result'); }, hide: vi.fn() });
  const transfer = vi.fn(() => new Promise<Cleanup>(resolve => { collect = resolve; }));
  const input = animatedInput({
    current: () => saved, persist: saveGame,
    animate: () => new Promise<Cleanup>(resolve => { land = resolve; }), capture: transfer,
    present: next => { saved = next as typeof saved; order.push('present'); result.update(saved.game, busy); },
    setBusy: next => { busy = next; if (!busy) result.update(saved.game); }
  });
  const step = input.tap(36);
  expect(loadGame().saved.captured).toHaveLength(1); // Already durable before either phase ends.
  expect(transfer).not.toHaveBeenCalled(); expect(input.busy).toBe(true);
  land(() => { order.push('attacker-cleanup'); }); await Promise.resolve(); await Promise.resolve();
  expect(transfer).toHaveBeenCalledTimes(1); expect(input.busy).toBe(true);
  const before = saved; await input.tap(18); expect(saved).toBe(before);
  collect(() => { order.push('capture-cleanup'); }); await step;
  expect(order).toEqual(['present', 'capture-cleanup', 'attacker-cleanup']);
  expect(input.busy).toBe(false); expect(saved.captured).toHaveLength(1);
});
it('al arrastrar omite el salto repetido pero conserva el traslado de la víctima', async () => {
  let saved = { ...chain(), from: 54 };
  const animate = vi.fn(async () => {}), capture = vi.fn(async () => {});
  const input = animatedInput({ current: () => saved, persist: vi.fn(),
    present: next => { saved = next as typeof saved; }, animate, capture, setBusy: vi.fn() });
  await input.tap(36, { animate: false });
  expect(animate).not.toHaveBeenCalled();
  expect(capture).toHaveBeenCalledWith({ from: 54, to: 36, captured: 45 }, saved, false);
  expect(saved.captured).toHaveLength(1);
});
