import { afterEach, expect, it, vi } from 'vitest';
import { applyMove, initialGame, legalMoves, outcome } from '../src/engine';
import { tapSquare } from '../src/interaction';
import { resultScreen } from '../src/result';
import { validateSaved } from '../src/storage';
import { animatedInput, type Cleanup } from '../src/animation';
import { ipadOpponent } from '../src/opponent';
import { createVictoryScenario, winningCapture } from './victory';
import { createVictoryStorage } from './victory-storage';
import { victoryConfig } from '../vite.victory.config';
import productionConfig from '../vite.config';

afterEach(() => vi.unstubAllGlobals());

it('prepara una posición legal no terminada con una sola ficha de cada color', () => {
  const saved = createVictoryScenario();
  expect(validateSaved(saved)).toBe(true);
  expect(saved.game.board.filter(piece => piece?.color === 'black')).toHaveLength(1);
  expect(saved.game.board.filter(piece => piece?.color === 'white')).toHaveLength(1);
  expect(outcome(saved.game)).toBeNull();
  expect(legalMoves(saved.game)).toContainEqual(winningCapture);
  expect(legalMoves(saved.game).some(move => move.captures.length === 0)).toBe(true);
});
it('la captura real de e4 a c6 elimina la última negra y produce victoria humana', () => {
  const next = applyMove(createVictoryScenario().game, winningCapture);
  expect(next.board[27]).toBeNull();
  expect(next.board[18]).toEqual({ color: 'black', king: false });
  expect(outcome(next)).toEqual({ winner: 'black' });
});
it('el escenario y su reinicio en memoria no acceden a las partidas normales', () => {
  const getItem = vi.fn(() => { throw new Error('No se debe leer localStorage'); });
  const setItem = vi.fn(() => { throw new Error('No se debe escribir localStorage'); });
  vi.stubGlobal('localStorage', { getItem, setItem });
  const memory = createVictoryStorage();
  const selected = tapSquare(memory.loadGame().saved, 36);
  const ended = tapSquare(selected, 18);
  expect(memory.saveGame(ended)).toBe(true);
  expect(outcome(memory.loadGame().saved.game)).toEqual({ winner: 'black' });
  memory.saveGame({ ...ended, game: initialGame(), from: null, path: [] });
  expect(memory.loadGame().saved.game).toEqual(initialGame());
  expect(getItem).not.toHaveBeenCalled(); expect(setItem).not.toHaveBeenCalled();
});
it('cada recarga de la vista empieza con un escenario nuevo y no comparte objetos', () => {
  const first = createVictoryStorage(), second = createVictoryStorage();
  first.saveGame(tapSquare(tapSquare(first.loadGame().saved, 36), 18));
  expect(outcome(second.loadGame().saved.game)).toBeNull();
  expect(second.loadGame().saved).toEqual(createVictoryScenario());
});
it('integra animación, felicitación y Nueva partida con los controladores reales', async () => {
  const memory = createVictoryStorage();
  let saved = memory.loadGame().saved, busy = false;
  let land!: (cleanup: Cleanup) => void;
  const show = vi.fn(), hide = vi.fn();
  const result = resultScreen({ show, hide });
  const input = animatedInput({
    current: () => saved, persist: memory.saveGame,
    present: next => { saved = next; result.update(saved.game, busy); },
    animate: () => new Promise<Cleanup>(resolve => { land = resolve; }),
    setBusy: next => { busy = next; if (!busy) result.update(saved.game); }
  });
  const opponent = ipadOpponent({
    current: () => saved, tap: input.tap, busy: () => busy,
    replace: next => { saved = next; memory.saveGame(next); result.update(saved.game); }
  });
  await opponent.humanTap(36);
  const capture = opponent.humanTap(18);
  expect(show).not.toHaveBeenCalled(); expect(result.finished).toBe(false);
  land(() => {}); await capture;
  expect(show).toHaveBeenCalledExactlyOnceWith({ title: '¡Has ganado!', message: '¡Muy bien jugado!', celebrate: true });
  result.update(saved.game); expect(show).toHaveBeenCalledTimes(1);
  expect(result.finished).toBe(true);
  expect(opponent.newGame()).toBe(true);
  expect(saved.game).toEqual(initialGame()); expect(hide).toHaveBeenCalledTimes(1);
});
it('bloquea explícitamente la compilación y el servidor de producción con esta configuración', () => {
  expect(() => victoryConfig({ command: 'build', mode: 'production' })).toThrow('no se puede compilar ni publicar');
  expect(() => victoryConfig({ command: 'serve', mode: 'production', isPreview: true })).toThrow('no se puede compilar ni publicar');
});
it('el alias y el puerto aislado solo existen en la configuración de desarrollo específica', () => {
  const config = victoryConfig({ command: 'serve', mode: 'development' });
  expect(config.server?.port).toBe(5175); expect(config.server?.strictPort).toBe(true);
  const alias = config.resolve?.alias;
  expect(Array.isArray(alias)).toBe(true);
  if (!Array.isArray(alias)) throw new Error('Falta el alias aislado');
  expect(alias.some(item => String(item.replacement).endsWith('/dev/victory-storage.ts'))).toBe(true);
  expect(productionConfig.resolve?.alias).toBeUndefined();
});
