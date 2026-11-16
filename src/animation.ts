import { candidates, destinationPaths, tapSquare } from './interaction';
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
  capture?(move: VisualMove, next: SavedGame, attackerAnimated: boolean): Promise<Cleanup | void>;
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
      const path = destinationPaths(before).get(square);
      if (!path) {
        const next = tapSquare(before, square);
        if (next !== before) { effects.persist(next); effects.present(next, square); }
        return;
      }
      const steps: { next: SavedGame; move: VisualMove }[] = [];
      let state = before;
      for (const destination of path) {
        const option = candidates(state).find(m => m.path[state.path.length] === destination)!;
        const move = { from: (state.path.at(-1) ?? state.from)!, to: destination,
          captured: option.captures[state.path.length] };
        state = tapSquare(state, destination);
        steps.push({ next: state, move });
      }
      // A shortcut chooses this stopping point, even if further jumps are possible.
      // A single landing retains the familiar optional continuation by stages.
      if (path.length > 1 && state.path.length) {
        state = tapSquare(state, square);
        steps[steps.length - 1].next = state;
      }
      busy = true;
      effects.setBusy(true);
      try {
        // Store the entire chosen route before motion: reload restores its final result.
        // Intermediate frames are presentation only and must not overwrite this save.
        effects.persist(state);
        for (const { next, move } of steps) {
          let cleanup: Cleanup | void = undefined;
          let captureCleanup: Cleanup | void = undefined;
          const animated = path.length > 1 || options.animate !== false;
          try {
            if (animated) cleanup = await effects.animate(move);
            if (move.captured !== undefined) captureCleanup = await effects.capture?.(move, next, animated);
          } catch (error) {
            console.error('No se pudo completar la animación de la jugada', error);
          } finally {
            try { effects.present(next, move.to); }
            finally { try { captureCleanup?.(); } finally { cleanup?.(); } }
          }
        }
      } finally {
        busy = false; effects.setBusy(false);
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
