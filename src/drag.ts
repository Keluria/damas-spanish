import { destinationPaths } from './interaction';
import { crossedDragThreshold, dragPlan } from './drag-model';
import type { SavedGame } from './storage';

interface Effects {
  current(): SavedGame;
  canInput(): boolean;
  preview(saved: SavedGame): void;
  restore(focus: number): void;
  commit(source: number, destination: number): Promise<boolean>;
  tap(square: number): void;
  setBusy(busy: boolean): void;
}
interface Gesture {
  id: number; source: number; startX: number; startY: number; x: number; y: number;
  plan: NonNullable<ReturnType<typeof dragPlan>>;
  dragging: boolean; token?: HTMLElement; layer?: HTMLElement; frame?: number;
}

/** Pointer capture stays on the board, whose children may be rendered again. */
export function installDragging(board: HTMLElement, effects: Effects) {
  let gesture: Gesture | undefined;
  let settling = false;
  let suppressClick = false;
  let returning: Animation | undefined;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  function square(element: Element | null): number | null {
    const cell = element?.closest<HTMLElement>('[data-square]');
    return cell && board.contains(cell) ? Number(cell.dataset.square) : null;
  }
  function atPoint(x: number, y: number) { return square(document.elementFromPoint(x, y)); }
  function release(g: Gesture) {
    if (g.frame !== undefined) cancelAnimationFrame(g.frame);
    try { if (board.hasPointerCapture(g.id)) board.releasePointerCapture(g.id); } catch { /* Pointer already cancelled. */ }
  }
  function paint(g: Gesture) {
    if (g.token) g.token.style.transform = `translate3d(${g.x - g.startX}px, ${g.y - g.startY}px, 0)`;
  }
  function remove(g: Gesture) { g.layer?.remove(); }
  async function returnHome(g: Gesture, instant: boolean, keepBusy = false) {
    settling = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (g.token && !instant && !reduced.matches && typeof g.token.animate === 'function') {
        returning = g.token.animate([
          { transform: g.token.style.transform }, { transform: 'translate3d(0, 0, 0)' }
        ], { duration: 180, easing: 'ease-out', fill: 'forwards' });
        await Promise.race([
          returning.finished.catch(() => {}),
          new Promise<void>(resolve => { timer = setTimeout(resolve, 300); })
        ]);
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      returning?.cancel(); returning = undefined;
      remove(g);
      effects.restore(g.source);
      if (!keepBusy) { settling = false; effects.setBusy(false); }
    }
  }
  async function cancel(instant = true) {
    if (!gesture) {
      if (instant && returning) { try { returning.finish(); } catch { returning.cancel(); } }
      return;
    }
    const g = gesture; gesture = undefined;
    suppressClick = true;
    release(g);
    if (g.dragging) await returnHome(g, instant);
  }
  function down(event: PointerEvent) {
    if (!event.isPrimary || event.button !== 0 || gesture || settling || !effects.canInput()) return;
    suppressClick = false;
    const source = square(event.target instanceof Element ? event.target : null);
    if (source === null) return;
    const plan = dragPlan(effects.current(), source);
    if (!plan) return;
    gesture = { id: event.pointerId, source, startX: event.clientX, startY: event.clientY,
      x: event.clientX, y: event.clientY, plan, dragging: false };
    try { board.setPointerCapture(event.pointerId); } catch { /* Synthetic/unavailable pointer capture. */ }
  }
  function move(event: PointerEvent) {
    const g = gesture;
    if (!g || g.id !== event.pointerId) return;
    g.x = event.clientX; g.y = event.clientY;
    if (!g.dragging && !crossedDragThreshold(g.x - g.startX, g.y - g.startY)) return;
    event.preventDefault();
    if (!g.dragging) {
      g.dragging = true; suppressClick = true; effects.setBusy(true);
      effects.preview(g.plan.selection);
      const token = board.querySelector<HTMLElement>(`[data-square="${g.source}"] .piece`);
      if (!token) { void cancel(true); return; }
      const rect = token.getBoundingClientRect();
      const layer = document.createElement('div');
      layer.className = 'drag-layer'; layer.setAttribute('aria-hidden', 'true');
      token.style.left = `${rect.left}px`; token.style.top = `${rect.top}px`;
      token.style.width = `${rect.width}px`; token.style.height = `${rect.height}px`;
      token.classList.add('dragging');
      document.body.append(layer); layer.append(token); // Move the original node, never a copy.
      g.token = token; g.layer = layer;
    }
    if (g.frame === undefined) g.frame = requestAnimationFrame(() => { g.frame = undefined; paint(g); });
  }
  async function up(event: PointerEvent) {
    const g = gesture;
    if (!g || g.id !== event.pointerId) return;
    gesture = undefined; release(g);
    if (!g.dragging) return; // The subsequent native click keeps the two-tap interaction.
    event.preventDefault();
    g.x = event.clientX; g.y = event.clientY; paint(g);
    const destination = atPoint(g.x, g.y);
    if (destination === null || !g.plan.destinations.includes(destination)) {
      await returnHome(g, false); return;
    }
    settling = true;
    // A multi-jump shortcut must show the real route, not a straight drag across victims.
    // Bring the original token home smoothly first, retaining the lock until all jumps end.
    if (destinationPaths(g.plan.selection).get(destination)!.length > 1) await returnHome(g, false, true);
    else remove(g);
    try {
      // Single jumps keep the displacement already performed by the user.
      if (!await effects.commit(g.source, destination)) effects.restore(g.source);
    } finally { settling = false; effects.setBusy(false); }
  }
  function click(event: MouseEvent) {
    if (gesture || settling || !effects.canInput()) return;
    const target = event.target instanceof Element ? event.target : null;
    const destination = square(target) ?? (event.detail ? atPoint(event.clientX, event.clientY) : null);
    if (destination !== null) effects.tap(destination);
  }
  function pointerCancel(event: PointerEvent) {
    // Ignore bubbled child losses and stale losses while this board still owns capture.
    if (event.type === 'lostpointercapture' && (event.target !== board || board.hasPointerCapture(event.pointerId))) return;
    if (gesture?.id === event.pointerId) void cancel(event.type === 'lostpointercapture');
  }
  const immediateCancel = () => { void cancel(true); };
  const hidden = () => { if (document.hidden) immediateCancel(); };
  const preference = () => { if (reduced.matches) immediateCancel(); };
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture) { event.preventDefault(); void cancel(false); } };
  // A drag's compatibility click may be retargeted after rendering (even to another control).
  document.addEventListener('pointerdown', () => { if (!gesture && !settling) suppressClick = false; }, true);
  document.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) {
      suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  board.addEventListener('pointerdown', down);
  board.addEventListener('pointermove', move, { passive: false });
  board.addEventListener('pointerup', event => { void up(event); });
  board.addEventListener('pointercancel', pointerCancel);
  board.addEventListener('lostpointercapture', pointerCancel);
  board.addEventListener('click', click, true);
  board.addEventListener('dragstart', event => event.preventDefault());
  window.addEventListener('blur', immediateCancel);
  window.addEventListener('resize', immediateCancel);
  window.addEventListener('orientationchange', immediateCancel);
  window.addEventListener('pagehide', immediateCancel);
  window.addEventListener('keydown', escape);
  document.addEventListener('visibilitychange', hidden);
  reduced.addEventListener('change', preference);
  return { cancel: immediateCancel };
}
