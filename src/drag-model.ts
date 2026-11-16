import { legalMoves, outcome } from './engine';
import { candidates } from './interaction';
import type { TapOptions } from './animation';
import type { SavedGame } from './storage';

export const DRAG_THRESHOLD = 8;
export function crossedDragThreshold(dx: number, dy: number): boolean {
  return Math.hypot(dx, dy) >= DRAG_THRESHOLD;
}
/** Preview selection without mutating or persisting the actual game. */
export function dragPlan(saved: SavedGame, source: number) {
  if (saved.game.turn !== 'white' || outcome(saved.game)) return null;
  if (saved.path.length) {
    if (saved.path.at(-1) !== source) return null;
  } else if (!legalMoves(saved.game).some(move => move.from === source)) return null;
  const selection = saved.path.length ? saved : { ...saved, from: source };
  const destinations = [...new Set(candidates(selection)
    .filter(move => move.path.length > selection.path.length)
    .map(move => move.path[selection.path.length]))];
  return destinations.length ? { selection, destinations } : null;
}
export async function commitDrag(
  saved: SavedGame, source: number, destination: number,
  tap: (square: number, options?: TapOptions) => Promise<void>
): Promise<boolean> {
  const plan = dragPlan(saved, source);
  if (!plan?.destinations.includes(destination)) return false;
  if (saved.from !== plan.selection.from) await tap(plan.selection.from!);
  await tap(destination, { animate: false });
  return true;
}
