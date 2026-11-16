import { chooseEasyMove } from './ai';
import { initialGame, legalMoves, outcome, type Move } from './engine';
import { candidates } from './interaction';
import type { SavedGame } from './storage';

interface Options {
  current(): SavedGame;
  tap(square: number): Promise<void>;
  busy(): boolean;
  replace(saved: SavedGame): void;
  choose?(saved: SavedGame, moves: readonly Move[]): Move;
  delay?: number;
}

/** Single owner of automatic black turns; the existing animated input plays every step. */
export function ipadOpponent(options: Options) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let suspended = false;
  let generation = 0;
  const blackTurn = () => options.current().game.turn === 'black' && !outcome(options.current().game);
  const active = (version: number) => version === generation && !suspended && blackTurn();
  function cancelPending() {
    generation++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  }
  function schedule() {
    if (suspended || running || timer !== undefined || options.busy() || !blackTurn()) return;
    const version = generation;
    timer = setTimeout(() => { timer = undefined; void play(version); }, options.delay ?? 650);
  }
  async function play(version: number) {
    if (!active(version) || options.busy() || running) return;
    running = true;
    let failed = false;
    try {
      const before = options.current();
      // Old local games and interrupted black captures use the same save format.
      const moves = before.path.length ? candidates(before) : legalMoves(before.game);
      const move = options.choose?.(before, moves) ?? chooseEasyMove(before.game, moves);
      if (!moves.some(candidate => JSON.stringify(candidate) === JSON.stringify(move))) throw new Error('La IA eligió un movimiento no permitido');
      if (before.from !== move.from) await options.tap(move.from);
      for (const destination of move.path.slice(before.path.length)) {
        if (!active(version)) return;
        await options.tap(destination);
      }
      if (!active(version)) return;
      // A chosen short capture prefix ends by tapping the moving piece, just like the human.
      const partial = options.current();
      if (partial.path.length) await options.tap(partial.path.at(-1)!);
    } catch (error) {
      failed = true;
      console.error('No se pudo completar el turno del iPad', error);
    } finally {
      running = false;
      if (!failed) schedule();
    }
  }
  return {
    async humanTap(square: number) {
      if (suspended || running || options.busy() || options.current().game.turn !== 'white') return;
      await options.tap(square);
      schedule();
    },
    resume() { suspended = false; schedule(); },
    suspend() { suspended = true; cancelPending(); },
    newGame() {
      // New game remains available during the thinking pause, never halfway through a jump.
      if (options.busy()) return false;
      cancelPending();
      options.replace({ version: 1, game: initialGame(), from: null, path: [] });
      return true;
    }
  };
}
