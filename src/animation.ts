import { candidates, tapSquare } from './interaction';
import type { SavedGame } from './storage';

export interface VisualMove { from: number; to: number; captured?: number }
export type Cleanup = () => void;
export interface TapOptions { animate?: boolean }

export function moveDuration(move: VisualMove): number {
  const squares = Math.abs(Math.floor(move.to / 8) - Math.floor(move.from / 8));
  return Math.min(770, 350 + Math.max(0, squares - 1) * 70);
}

interface Effects {
  current(): SavedGame;
  persist(next: SavedGame): void;
  present(next: SavedGame, focus: number): void;
  animate(move: VisualMove): Promise<Cleanup | void>;
  setBusy(busy: boolean): void;
}
/** The existing interaction is the only authority for rules and state. */
export function animatedInput(effects: Effects) {
  let busy = false;
  return {
    get busy() { return busy; },
    async tap(square: number, options: TapOptions = {}) {
      if (busy) return; // Ignore input rather than queueing unintended turns.
      const before = effects.current();
      const next = tapSquare(before, square);
      if (next === before) return;
      const option = candidates(before).find(m => m.path[before.path.length] === square);
      const from = before.path.at(-1) ?? before.from;
      if (!option || from === null) {
        effects.persist(next);
        effects.present(next, square);
        return;
      }
      busy = true;
      effects.setBusy(true);
      let cleanup: Cleanup | void = undefined;
      try {
        // Durable before motion starts: reloading during a jump restores the chosen move.
        effects.persist(next);
        if (options.animate !== false) {
          cleanup = await effects.animate({ from, to: square, captured: option.captures[before.path.length] });
        }
      } catch {
        // An unavailable/cancelled animation never rolls back or changes a legal move.
      } finally {
        try {
          // Replace the board before removing the forwards-filled transform: no flash at origin.
          effects.present(next, square);
        } finally {
          try { cleanup?.(); }
          finally { busy = false; effects.setBusy(false); }
        }
      }
    }
  };
}

/** Animate the actual token, leaving the victim and all highlights in place until landing. */
export async function animatePiece(board: HTMLElement, move: VisualMove): Promise<Cleanup | void> {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || document.hidden) return;
  const source = board.querySelector<HTMLElement>(`[data-square="${move.from}"]`);
  const target = board.querySelector<HTMLElement>(`[data-square="${move.to}"]`);
  const token = source?.querySelector<HTMLElement>('.piece');
  if (!source || !target || !token || typeof token.animate !== 'function') return;
  const start = source.getBoundingClientRect(), end = target.getBoundingClientRect();
  if (!start.width || !start.height) return;
  const dx = end.left - start.left, dy = end.top - start.top;
  const translate = (x: number, y: number, scale = 1) => `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
  const frames: Keyframe[] = [{ transform: translate(0, 0), offset: 0 }];
  if (move.captured !== undefined) {
    const ratio = (Math.floor(move.captured / 8) - Math.floor(move.from / 8)) /
      (Math.floor(move.to / 8) - Math.floor(move.from / 8));
    frames.push({ transform: translate(dx * ratio, dy * ratio - Math.min(14, start.height * .16), 1.04), offset: ratio });
  }
  frames.push({ transform: translate(dx, dy), offset: 1 });
  const zIndex = source.style.zIndex;
  source.style.zIndex = '2';
  token.classList.add('moving');
  let animation: Animation;
  try {
    animation = token.animate(frames, { duration: moveDuration(move), easing: 'ease-in-out', fill: 'forwards' });
  } catch {
    source.style.zIndex = zIndex;
    token.classList.remove('moving');
    return;
  }
  const cancel = () => animation.cancel();
  const visibility = () => { if (document.hidden) cancel(); };
  const preference = () => { if (reduced.matches) cancel(); };
  document.addEventListener('visibilitychange', visibility);
  window.addEventListener('resize', cancel);
  reduced.addEventListener('change', preference);
  // Safety net for interrupted rendering / stalled animation promises on mobile browsers.
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<void>(resolve => { timeout = setTimeout(resolve, moveDuration(move) + 200); });
  try { await Promise.race([animation.finished.catch(() => {}), deadline]); }
  finally {
    clearTimeout(timeout!);
    document.removeEventListener('visibilitychange', visibility);
    window.removeEventListener('resize', cancel);
    reduced.removeEventListener('change', preference);
  }
  // The caller commits the landing board synchronously before disposing this token.
  return () => {
    animation.cancel();
    source.style.zIndex = zIndex;
    token.classList.remove('moving');
  };
}
