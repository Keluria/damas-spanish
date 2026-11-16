import type { Cleanup, VisualMove } from './animation';
import type { SavedGame } from './storage';

export const CAPTURE_TRANSFER_MS = 650;

/** One cancellation scope covers the attacker jump and the subsequent victim flight. */
export function captureAnimations(board: HTMLElement, tray: HTMLElement) {
  let transaction: AbortController | undefined;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const interrupt = () => transaction?.abort();
  window.addEventListener('resize', interrupt);
  window.addEventListener('orientationchange', interrupt);
  window.addEventListener('pagehide', interrupt);
  window.addEventListener('blur', interrupt);
  window.addEventListener('scroll', interrupt, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
  reduced.addEventListener('change', () => { if (reduced.matches) interrupt(); });
  return {
    begin() { transaction?.abort(); transaction = new AbortController(); },
    end() { transaction?.abort(); transaction = undefined; },
    async transfer(move: VisualMove, next: SavedGame, attackerAnimated: boolean): Promise<Cleanup | void> {
      const signal = transaction?.signal;
      if (move.captured === undefined || signal?.aborted || reduced.matches || document.hidden) return;
      const victim = board.querySelector<HTMLElement>(`[data-square="${move.captured}"] .piece`);
      const piece = next.captured?.at(-1);
      if (!victim || !piece) throw new Error('No se encuentra la ficha que debe ir a la colección');
      const index = next.captured!.filter(p => p.color === piece.color).length - 1;
      const slot = tray.querySelector<HTMLElement>(`[data-captured-slot="${piece.color}-${index}"]`);
      if (!slot || typeof victim.animate !== 'function') return;
      const placeholder = document.createElement('span');
      placeholder.className = `piece ${piece.color} capture-placeholder`;
      placeholder.setAttribute('aria-hidden', 'true'); slot.append(placeholder);
      const destination = placeholder.getBoundingClientRect();
      const origin = victim.getBoundingClientRect();
      if (!origin.width || !destination.width) { placeholder.remove(); return; }
      const layer = document.createElement('div');
      layer.dataset.capturedFrom = String(move.captured);
      layer.dataset.targetSlot = `${piece.color}-${index}`;
      layer.className = 'capture-layer'; layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
      const moved: { token: HTMLElement; source: HTMLElement; style: string | null; className: string }[] = [];
      function lift(token: HTMLElement, left: number, top: number) {
        const rect = token.getBoundingClientRect();
        moved.push({ token, source: token.parentElement!, style: token.getAttribute('style'), className: token.className });
        token.style.left = `${left}px`; token.style.top = `${top}px`;
        token.style.width = `${rect.width}px`; token.style.height = `${rect.height}px`;
        token.classList.add('in-capture-layer'); layer.append(token);
      }
      // A dragged attacker already reached its destination; hold it there, without another animation.
      if (!attackerAnimated) {
        const attacker = board.querySelector<HTMLElement>(`[data-square="${move.from}"] .piece`);
        const landing = board.querySelector<HTMLElement>(`[data-square="${move.to}"]`);
        if (attacker && landing) {
          const a = attacker.getBoundingClientRect(), b = landing.getBoundingClientRect();
          lift(attacker, b.left + (b.width - a.width) / 2, b.top + (b.height - a.height) / 2);
        }
      }
      lift(victim, origin.left, origin.top);
      victim.classList.add('captured-travelling'); victim.style.transformOrigin = 'top left';
      const dx = destination.left - origin.left, dy = destination.top - origin.top;
      const scale = destination.width / origin.width;
      const cleanupNodes = () => {
        for (const item of moved) {
          if (item.source.isConnected) item.source.append(item.token);
          if (item.style === null) item.token.removeAttribute('style'); else item.token.setAttribute('style', item.style);
          item.token.className = item.className;
        }
        layer.remove(); placeholder.remove();
      };
      let animation: Animation;
      try {
        animation = victim.animate([
          { transform: 'translate3d(0, 0, 0) scale(1)', offset: 0 },
          { transform: `translate3d(${dx * .75}px, ${dy * .75}px, 0) scale(1)`, offset: .65 },
          { transform: `translate3d(${dx}px, ${dy}px, 0) scale(${scale})`, offset: 1 }
        ], { duration: CAPTURE_TRANSFER_MS, easing: 'ease-in-out', fill: 'forwards' });
      } catch (error) { cleanupNodes(); throw error; }
      const cancel = () => animation.cancel();
      signal?.addEventListener('abort', cancel, { once: true });
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          animation.finished.catch(error => { if (!signal?.aborted) console.error('Se interrumpió el traslado de la ficha capturada', error); }),
          new Promise<void>(resolve => { timer = setTimeout(resolve, CAPTURE_TRANSFER_MS + 250); })
        ]);
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        signal?.removeEventListener('abort', cancel);
      }
      // Keep forwards fill until the landing board/tray has been rendered, avoiding a flash at origin.
      return () => { animation.cancel(); cleanupNodes(); };
    }
  };
}
