import { applyMove, legalMoves, outcome, type Move } from './engine';
import { recordCapture } from './captured';
import type { SavedGame } from './storage';

export function candidates(saved: SavedGame): Move[] {
  return legalMoves(saved.game).filter(m => m.from === saved.from && saved.path.every((p, i) => p === m.path[i]));
}
function finish(saved: SavedGame, move: Move): SavedGame {
  return { ...saved, game: applyMove(saved.game, move), from: null, path: [] };
}
/** A tap on the moving piece ends an optional chain without another control. */
export function tapSquare(saved: SavedGame, square: number): SavedGame {
  if (outcome(saved.game)) return saved;
  const moves = candidates(saved);
  if (saved.path.length && square === saved.path.at(-1)) {
    const completed = moves.find(m => m.path.length === saved.path.length);
    return completed ? finish(saved, completed) : saved;
  }
  const options = moves.filter(m => m.path[saved.path.length] === square);
  if (options.length) {
    const path = [...saved.path, square];
    const victim = options[0].captures[saved.path.length];
    const progress = victim === undefined ? saved : recordCapture(saved, victim);
    const completed = options.find(m => m.path.length === path.length);
    if (completed && !options.some(m => m.path.length > path.length)) return finish(progress, completed);
    return { ...progress, path };
  }
  // Once a chain starts, only this piece can continue or finish the turn.
  if (saved.path.length) return saved;
  if (saved.from === square) return { ...saved, from: null };
  if (legalMoves(saved.game).some(m => m.from === square)) return { ...saved, from: square };
  return saved;
}
