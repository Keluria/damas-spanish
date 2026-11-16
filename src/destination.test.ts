import { afterEach, expect, it, vi } from 'vitest';
import { applyMove, legalMoves, positionKey, type Board } from './engine';
import { destinationPaths, tapSquare } from './interaction';
import { animatedInput, type Cleanup } from './animation';
import { commitDrag, dragPlan } from './drag-model';
import { loadGame, saveGame, type SavedGame } from './storage';

function fixture(white = [45, 27, 9], king = false): SavedGame {
  const board: Board = Array(64).fill(null);
  board[54] = { color: 'black', king };
  for (const square of white) board[square] = { color: 'white', king: false };
  return { version: 2, game: { board, turn: 'black', positions: [positionKey(board, 'black')] }, from: 54, path: [] };
}
function harness(initial: SavedGame) {
  let saved = initial;
  const events: string[] = [];
  const input = animatedInput({ current: () => saved, persist: saveGame,
    animate: async move => { events.push(`jump:${move.from}:${move.to}`); },
    capture: async move => { events.push(`capture:${move.captured}`); },
    present: next => { saved = next; }, setBusy: busy => { events.push(`busy:${busy}`); } });
  return { input, events, current: () => saved };
}
afterEach(() => vi.unstubAllGlobals());

it('resalta todos los prefijos de captura doble y triple, sin exigir continuar', () => {
  expect([...destinationPaths(fixture()).keys()]).toEqual(expect.arrayContaining([36, 18, 0]));
  const first = tapSquare(fixture(), 36);
  expect(first.path).toEqual([36]);
  expect(tapSquare(first, 36).game.turn).toBe('white');
});
it('elige numéricamente la ruta equivalente y no depende de una preferencia de cantidad', () => {
  const saved = fixture([18, 20, 22, 32, 45], true);
  expect(legalMoves(saved.game).filter(m => m.path.at(-1) === 9)).toHaveLength(2);
  expect(destinationPaths(saved).get(9)).toEqual([[27, 9]]);
});
it('ofrece todas las rutas con capturas diferentes al mismo destino para elegir', () => {
  const saved = fixture([11, 13, 29, 45, 47], true);
  expect(destinationPaths(saved).get(22)).toEqual([[18, 4, 22], [36, 22]]);
  expect(dragPlan(saved, 54)!.destinations).toContain(22);
  const step = tapSquare(saved, 36);
  expect(destinationPaths(step).get(22)).toEqual([[22]]);
});
it('un destino inmediato sigue disponible como una etapa', () => {
  const saved = fixture();
  expect(destinationPaths(saved).get(36)).toEqual([[36]]);
});
it.each([2, 3])('ejecuta %i saltos y traslados en orden con un único bloqueo', async count => {
  const initial = fixture(count === 2 ? [45, 27] : undefined);
  const h = harness(initial), target = count === 2 ? 18 : 0;
  await h.input.tap(target);
  const route = legalMoves(initial.game).find(m => m.path.length === count && m.path.at(-1) === target)!;
  expect(h.current().game).toEqual(applyMove(initial.game, route));
  expect(h.current().captured).toHaveLength(count);
  expect(h.events).toEqual(count === 2
    ? ['busy:true','jump:54:36','capture:45','jump:36:18','capture:27','busy:false']
    : ['busy:true','jump:54:36','capture:45','jump:36:18','capture:27','jump:18:0','capture:9','busy:false']);
  if (count === 3) expect(h.current().game.board[0]!.king).toBe(true);
});
it('un atajo puede terminar en un prefijo aunque exista otro salto, sin captura obligatoria', async () => {
  const h = harness(fixture()); await h.input.tap(18);
  expect(h.current().game.turn).toBe('white'); expect(h.current().game.board[9]).not.toBeNull();
  expect(h.current().captured).toHaveLength(2);
});
it('permite elegir destino distante después de un primer salto manual', async () => {
  const h = harness(tapSquare(fixture(), 36)); await h.input.tap(0);
  expect(h.events).toEqual(['busy:true','jump:36:18','capture:27','jump:18:0','capture:9','busy:false']);
  expect(h.current().captured).toHaveLength(3);
});
it('guarda el resultado completo antes del primer salto y no lo reemplaza por cuadros intermedios', async () => {
  let raw: string | null = null;
  vi.stubGlobal('localStorage', { getItem: () => raw, setItem: (_k: string, value: string) => { raw = value; } });
  let saved = fixture(), release!: (cleanup?: Cleanup) => void, animations = 0;
  const busy: boolean[] = [];
  const input = animatedInput({ current: () => saved, persist: saveGame,
    animate: () => ++animations === 1 ? new Promise<Cleanup | void>(resolve => { release = resolve; }) : Promise.resolve(),
    capture: async () => {}, present: next => { saved = next; expect(loadGame().saved.game.board[0]).toBeTruthy(); },
    setBusy: value => { busy.push(value); } });
  const pending = input.tap(0);
  expect(input.busy).toBe(true);
  const restored = loadGame().saved;
  expect(restored.game.board[0]).toEqual({ color: 'black', king: true });
  expect(restored.captured).toHaveLength(3); expect(restored.path).toEqual([]);
  await input.tap(36); expect(animations).toBe(1);
  release(); await pending;
  expect(busy).toEqual([true, false]); expect(saved).toEqual(restored);
});
it('arrastrar al destino final solicita los saltos reales; un salto único no se reproduce', async () => {
  const tap = vi.fn(async () => {}), saved = fixture();
  expect(await commitDrag(saved, 54, 0, tap)).toBe(true);
  expect(tap).toHaveBeenLastCalledWith(0, { animate: true });
  await commitDrag(saved, 54, 36, tap);
  expect(tap).toHaveBeenLastCalledWith(36, { animate: false });
});
it('un destino ambiguo no cambia selección, guardado ni turno', async () => {
  const saved = fixture([11, 13, 29, 45, 47], true), h = harness(saved);
  await h.input.tap(22); expect(h.current()).toBe(saved); expect(h.events).toEqual(['busy:true', 'busy:false']);
  const tap = vi.fn(async () => {}); expect(await commitDrag(saved, 54, 22, tap)).toBe(true); expect(tap).toHaveBeenCalledWith(22, { animate: true });
});

it('no acepta atajos después de tablas aunque queden movimientos en el tablero', async () => {
  const saved = fixture(); saved.game.positions = Array(3).fill(positionKey(saved.game.board, 'black'));
  expect(destinationPaths(saved).size).toBe(0);
  const h = harness(saved); await h.input.tap(0); expect(h.current()).toBe(saved); expect(h.events).toEqual([]);
});

it.each([{ path: [36] }, { path: [18, 4, 22, 36] }])('permite elegir la ruta $path cuando un destino es inmediato y también final', async ({ path }) => {
  let saved = fixture([11, 13, 29, 31, 45], true);
  const paths = destinationPaths(saved).get(36)!;
  expect(paths).toContainEqual([36]); expect(paths).toContainEqual([18, 4, 22, 36]);
  const choosePath = vi.fn(async () => path);
  const input = animatedInput({ current: () => saved, persist: vi.fn(), present: next => { saved = next; },
    animate: async () => {}, capture: async () => {}, setBusy: vi.fn(), choosePath });
  await input.tap(36);
  expect(choosePath).toHaveBeenCalledTimes(1);
  expect(saved.captured).toHaveLength(path.length);
  if (path.length === 1) { expect(saved.path).toEqual([36]); expect(saved.game.turn).toBe('black'); }
  else { expect(saved.path).toEqual([]); expect(saved.game.turn).toBe('white'); }
});
it('cancelar la elección conserva selección, guardado y partida', async () => {
  const saved = fixture([11, 13, 29, 45, 47], true), persist = vi.fn();
  const input = animatedInput({ current: () => saved, persist, present: vi.fn(), animate: vi.fn(), setBusy: vi.fn(), choosePath: async () => undefined });
  await input.tap(22); expect(persist).not.toHaveBeenCalled(); expect(input.busy).toBe(false);
});

it('una cadena que regresa al origen no impide deseleccionar ni oculta el destino final', async () => {
  const saved = fixture([11,13,20,25,27,29],true);
  saved.game.board[36] = saved.game.board[54]; saved.game.board[54] = null;
  saved.game.positions = [positionKey(saved.game.board,'black')]; saved.from=36;
  expect(destinationPaths(saved).get(36)).toEqual([[],[18,4,22,36]]);
  let current = saved;
  const input = animatedInput({ current:()=>current, persist:vi.fn(), present:next=>{current=next;},
    animate:async()=>{}, setBusy:vi.fn(), choosePath:async()=>[] });
  await input.tap(36); expect(current.from).toBeNull(); expect(current.game).toBe(saved.game);
});
