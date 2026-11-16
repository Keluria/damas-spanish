import { afterEach, describe, expect, it, vi } from 'vitest';
import { animatedInput, animatePiece, moveDuration, type Cleanup, type VisualMove } from './animation';
import { initialGame, positionKey, type Board } from './engine';
import { tapSquare } from './interaction';
import { loadGame, saveGame, type SavedGame } from './storage';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function initial(): SavedGame { return { version: 1, game: initialGame(), from: null, path: [] }; }
function chain(): SavedGame {
  const board: Board = Array(64).fill(null);
  board[54] = board[50] = { color: 'white', king: false };
  board[45] = board[27] = { color: 'black', king: false };
  return { version: 1, game: { board, turn: 'white', positions: [positionKey(board, 'white')] }, from: null, path: [] };
}
function harness(start = initial()) {
  let state = start;
  const motion = deferred<Cleanup | void>();
  const timeline: string[] = [];
  const cleanup = vi.fn(() => { timeline.push('cleanup'); });
  const persist = vi.fn();
  const present = vi.fn((next: SavedGame) => { state = next; timeline.push('present'); });
  const animate = vi.fn((_move: VisualMove) => motion.promise);
  const busy = vi.fn();
  const input = animatedInput({ current: () => state, persist, present, animate, setBusy: busy });
  return { input, state: () => state, motion, persist, present, animate, busy, cleanup, timeline };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('estado e interacción animada', () => {
  it('seleccionar y cambiar de ficha no anima ni modifica el estado del motor', async () => {
    const h = harness(); const original = h.state().game;
    await h.input.tap(41); await h.input.tap(43);
    expect(h.state().from).toBe(43); expect(h.state().game).toBe(original);
    expect(h.animate).not.toHaveBeenCalled(); expect(h.input.busy).toBe(false);
  });
  it('guarda primero, bloquea pulsaciones repetidas y presenta el turno al aterrizar', async () => {
    const h = harness(); await h.input.tap(41);
    const before = h.state(), expected = tapSquare(before, 32);
    h.present.mockClear(); h.persist.mockClear(); h.timeline.length = 0;
    const landing = h.input.tap(32);
    expect(h.input.busy).toBe(true); expect(h.state()).toBe(before);
    expect(h.state().game.turn).toBe('white');
    expect(h.persist).toHaveBeenCalledExactlyOnceWith(expected);
    expect(h.animate).toHaveBeenCalledExactlyOnceWith({ from: 41, to: 32, captured: undefined });
    await h.input.tap(43); await h.input.tap(34);
    expect(h.present).not.toHaveBeenCalled(); expect(h.animate).toHaveBeenCalledTimes(1);
    h.motion.resolve(h.cleanup); await landing;
    expect(h.state()).toEqual(expected); expect(h.state().game.turn).toBe('black');
    expect(h.timeline).toEqual(['present', 'cleanup']); expect(h.input.busy).toBe(false);
    expect(h.busy.mock.calls).toEqual([[true], [false]]);
  });
  it('no obliga a capturar aunque el movimiento normal esté animado', async () => {
    const h = harness(chain()); await h.input.tap(50);
    const expected = tapSquare(h.state(), 41), landing = h.input.tap(41);
    h.motion.resolve(); await landing;
    expect(h.state()).toEqual(expected); expect(h.state().game.board[45]?.color).toBe('black');
  });
  it('anima cada salto desde la posición actual y permite detener la cadena', async () => {
    const h = harness(chain()); await h.input.tap(54);
    const first = h.input.tap(36);
    expect(h.state().path).toEqual([]); // The old projection, including the victim, stays visible.
    expect(h.animate).toHaveBeenLastCalledWith({ from: 54, to: 36, captured: 45 });
    h.motion.resolve(); await first;
    expect(h.state().path).toEqual([36]); expect(h.state().game.turn).toBe('white');
    const partial = h.state();
    await h.input.tap(36);
    expect(h.animate).toHaveBeenCalledTimes(1); // Voluntary stop has no displacement.
    expect(h.state()).toEqual(tapSquare(partial, 36)); expect(h.state().game.turn).toBe('black');
  });
  it('completa los saltos secuenciales sin alterar las capturas ni la posición final', async () => {
    const h = harness(chain()); const plain = tapSquare(tapSquare(tapSquare(chain(), 54), 36), 18);
    await h.input.tap(54);
    const first = h.input.tap(36); h.motion.resolve(); await first;
    const second = h.input.tap(18); await second;
    expect(h.animate.mock.calls.map(([m]) => m)).toEqual([
      { from: 54, to: 36, captured: 45 }, { from: 36, to: 18, captured: 27 }
    ]);
    expect(h.state()).toEqual(plain);
    expect(h.state().game.board[45]).toBeNull(); expect(h.state().game.board[27]).toBeNull();
  });
  it('recupera desde el guardado el salto elegido incluso si se recarga durante la animación', async () => {
    let raw: string | null = null;
    vi.stubGlobal('localStorage', { setItem: (_key: string, value: string) => { raw = value; }, getItem: () => raw });
    const h = harness(chain()); h.persist.mockImplementation(saveGame);
    await h.input.tap(54); const before = h.state(); const pending = h.input.tap(36);
    expect(h.state()).toBe(before);
    expect(loadGame().saved).toEqual(tapSquare(before, 36)); expect(loadGame().warning).toBe('');
    h.motion.resolve(); await pending;
  });
  it('una animación fallida presenta el mismo movimiento legal y desbloquea el tablero', async () => {
    const h = harness(); await h.input.tap(41);
    const expected = tapSquare(h.state(), 32), landing = h.input.tap(32);
    h.motion.reject(new Error('Animation interrupted')); await landing;
    expect(h.state()).toEqual(expected); expect(h.input.busy).toBe(false);
  });
  it('una dama conserva su desplazamiento largo legal con animación', async () => {
    const board: Board = Array(64).fill(null);
    board[63] = { color: 'white', king: true }; board[7] = { color: 'black', king: false };
    const h = harness({ version: 1, game: { board, turn: 'white', positions: [positionKey(board, 'white')] }, from: 63, path: [] });
    const expected = tapSquare(h.state(), 0), landing = h.input.tap(0);
    expect(h.animate).toHaveBeenCalledWith({ from: 63, to: 0, captured: undefined });
    h.motion.resolve(); await landing;
    expect(h.state()).toEqual(expected); expect(h.state().game.board[0]?.king).toBe(true);
  });
  it('presenta la coronación y el nuevo turno solo después de aterrizar', async () => {
    const board: Board = Array(64).fill(null);
    board[9] = { color: 'white', king: false }; board[63] = { color: 'black', king: false };
    const h = harness({ version: 1, game: { board, turn: 'white', positions: [positionKey(board, 'white')] }, from: 9, path: [] });
    const landing = h.input.tap(0);
    expect(h.state().game.board[9]?.king).toBe(false); expect(h.state().game.turn).toBe('white');
    h.motion.resolve(); await landing;
    expect(h.state().game.board[0]?.king).toBe(true); expect(h.state().game.turn).toBe('black');
  });
  it('un toque inválido no anima, no guarda ni altera la partida', async () => {
    const h = harness(); const before = h.state(); await h.input.tap(0);
    expect(h.state()).toBe(before); expect(h.animate).not.toHaveBeenCalled();
    expect(h.persist).not.toHaveBeenCalled();
  });
});

// A minimal browser surface tests Web Animations lifecycle without adding runtime dependencies.
function browser(reduce = false) {
  vi.useFakeTimers();
  const finished = deferred<void>();
  const cancel = vi.fn(() => finished.reject(new Error('cancelled')));
  const animation = { finished: finished.promise, cancel };
  const classes = new Set<string>();
  const token = {
    classList: { add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) },
    animate: vi.fn(() => animation)
  };
  const source = { style: { zIndex: '' }, querySelector: () => token,
    getBoundingClientRect: () => ({ left: 100, top: 200, width: 80, height: 80 }) };
  const target = { getBoundingClientRect: () => ({ left: 260, top: 40, width: 80, height: 80 }) };
  const board = { querySelector: vi.fn((selector: string) => selector.includes('54') ? source : target) } as unknown as HTMLElement;
  const preference = Object.assign(new EventTarget(), { matches: reduce });
  const win = Object.assign(new EventTarget(), { matchMedia: vi.fn(() => preference) });
  const doc = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('window', win); vi.stubGlobal('document', doc);
  return { board, token, classes, source, finished, cancel, win, doc, preference };
}
describe('presentación y accesibilidad', () => {
  it('usa unos 350 ms y alarga gradualmente los desplazamientos largos', () => {
    expect(moveDuration({ from: 41, to: 32 })).toBe(350);
    expect(moveDuration({ from: 63, to: 0 })).toBe(770);
    expect(moveDuration({ from: 54, to: 36 })).toBeGreaterThan(350);
  });
  it('anima la ficha existente con transform y un salto discreto sin tocar la víctima', async () => {
    const h = browser(); const pending = animatePiece(h.board, { from: 54, to: 36, captured: 45 });
    expect(h.token.animate).toHaveBeenCalledTimes(1);
    const [frames, options] = h.token.animate.mock.calls[0] as unknown as [Keyframe[], KeyframeAnimationOptions];
    expect(frames).toHaveLength(3); expect(frames[1].offset).toBe(.5);
    expect(frames[0].transform).toContain('translate3d(0px, 0px, 0)');
    expect(frames.at(-1)?.transform).toContain('translate3d(160px, -160px, 0)');
    expect(options.fill).toBe('forwards'); expect(h.classes.has('moving')).toBe(true);
    expect(h.board.querySelector).not.toHaveBeenCalledWith('[data-square="45"]');
    h.finished.resolve(); const cleanup = await pending;
    expect(h.cancel).not.toHaveBeenCalled(); // Keep final position until landing render replaces the board.
    cleanup?.(); expect(h.cancel).toHaveBeenCalledTimes(1);
    expect(h.classes.has('moving')).toBe(false); expect(h.source.style.zIndex).toBe('');
  });
  it('la reducción de movimiento omite la animación y permite el mismo estado final', async () => {
    const h = browser(true), start = initial(); let state = tapSquare(start, 41);
    const expected = tapSquare(state, 32);
    const input = animatedInput({ current: () => state, persist: vi.fn(), present: next => { state = next; },
      animate: move => animatePiece(h.board, move), setBusy: vi.fn() });
    await input.tap(32);
    expect(state).toEqual(expected); expect(h.token.animate).not.toHaveBeenCalled(); expect(input.busy).toBe(false);
  });
  it.each(['resize', 'hidden', 'reduce'] as const)('una interrupción %s completa el movimiento sin dejarlo bloqueado', async reason => {
    const h = browser(); const pending = animatePiece(h.board, { from: 54, to: 36 });
    if (reason === 'resize') h.win.dispatchEvent(new Event('resize'));
    if (reason === 'hidden') { h.doc.hidden = true; h.doc.dispatchEvent(new Event('visibilitychange')); }
    if (reason === 'reduce') { h.preference.matches = true; h.preference.dispatchEvent(new Event('change')); }
    const cleanup = await pending; cleanup?.();
    expect(h.classes.has('moving')).toBe(false);
    const count = h.cancel.mock.calls.length;
    h.win.dispatchEvent(new Event('resize')); expect(h.cancel).toHaveBeenCalledTimes(count);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('el plazo de seguridad libera animaciones que no resuelven finished', async () => {
    const h = browser(); const pending = animatePiece(h.board, { from: 54, to: 36 });
    await vi.advanceTimersByTimeAsync(1000);
    const cleanup = await pending; cleanup?.();
    expect(h.cancel).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it('si Web Animations falla, restaura los estilos y usa movimiento instantáneo', async () => {
    const h = browser(); h.token.animate.mockImplementation(() => { throw new Error('unavailable'); });
    expect(await animatePiece(h.board, { from: 54, to: 36 })).toBeUndefined();
    expect(h.classes.has('moving')).toBe(false); expect(h.source.style.zIndex).toBe('');
  });
});
