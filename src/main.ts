import './style.css';
import { applyMove, legalMoves, outcome, type Board, type Move } from './engine';
import { loadGame, saveGame } from './storage';
import { initialGame } from './engine';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const loaded = loadGame();
let saved = loaded.saved;
let warning = loaded.warning;
const boardEl = el('board');
const name = (color: string) => color === 'white' ? 'blancas' : 'negras';
const squareName = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
function candidates(): Move[] {
  return legalMoves(saved.game).filter(m => m.from === saved.from && saved.path.every((p, i) => p === m.path[i]));
}
function persist() {
  el('save-status').textContent = saveGame(saved) ? (warning || 'Partida guardada en este dispositivo') : 'No se puede guardar. Mantén esta ventana abierta para conservar la partida.';
}
function render(focus?: number) {
  const end = outcome(saved.game);
  const moves = end ? [] : legalMoves(saved.game);
  const next = new Set(candidates().map(m => m.path[saved.path.length]));
  const current = saved.path.at(-1) ?? saved.from;
  const board: Board = saved.game.board.slice();
  if (saved.from !== null && saved.path.length) {
    const piece = board[saved.from]; board[saved.from] = null;
    candidates()[0]?.captures.slice(0, saved.path.length).forEach(i => { board[i] = null; });
    board[current!] = piece;
  }
  el('status').textContent = end ? ('winner' in end ? `Ganan las ${name(end.winner)}` : 'Tablas por repetición') : `Turno de las ${name(saved.game.turn)}`;
  el('hint').textContent = end ? 'Puedes empezar una nueva partida.' : saved.path.length ? 'Sigue capturando: toca una casilla marcada.' : saved.from !== null ? 'Ahora toca una casilla marcada.' : moves.some(m => m.captures.length) ? 'Hay que capturar. Toca una ficha señalada.' : 'Toca una ficha para moverla.';
  el('turn-piece').className = `piece ${saved.game.turn}`;
  boardEl.replaceChildren();
  for (let i = 0; i < 64; i++) {
    const playable = (Math.floor(i / 8) + i % 8) % 2 === 0;
    const cell = document.createElement(playable ? 'button' : 'div');
    cell.className = `cell ${playable ? 'playable' : 'dark'}${i === current ? ' selected' : ''}${next.has(i) ? ' destination' : ''}`;
    if (playable) {
      const button = cell as HTMLButtonElement;
      button.type = 'button';
      button.dataset.square = String(i);
      button.setAttribute('aria-pressed', String(i === current));
      const piece = board[i];
      const movable = !end && !saved.path.length && moves.some(m => m.from === i);
      button.setAttribute('aria-label', `${squareName(i)}: ${piece ? `${piece.king ? 'dama' : 'ficha'} ${name(piece.color)}` : 'vacía'}${next.has(i) ? ', destino permitido' : movable ? ', puede mover' : ''}${i === current ? ', seleccionada' : ''}`);
      if (piece) {
        const token = document.createElement('span');
        token.className = `piece ${piece.color}${movable ? ' movable' : ''}`;
        token.setAttribute('aria-hidden', 'true');
        token.textContent = piece.king ? '♛' : '';
        button.append(token);
      }
      if (next.has(i)) { const dot = document.createElement('span'); dot.className = 'marker'; dot.setAttribute('aria-hidden', 'true'); cell.append(dot); }
      button.addEventListener('click', () => click(i));
    } else cell.setAttribute('aria-hidden', 'true');
    boardEl.append(cell);
  }
  persist();
  if (focus !== undefined) boardEl.querySelector<HTMLButtonElement>(`[data-square="${focus}"]`)?.focus({ preventScroll: true });
}
function click(i: number) {
  if (outcome(saved.game)) return;
  const options = candidates().filter(m => m.path[saved.path.length] === i);
  if (options.length) {
    saved.path.push(i);
    const complete = options.find(m => m.path.length === saved.path.length);
    if (complete) { saved.game = applyMove(saved.game, complete); saved.from = null; saved.path = []; }
  } else if (!saved.path.length) {
    if (saved.from === i) saved.from = null;
    else if (legalMoves(saved.game).some(m => m.from === i)) saved.from = i;
  }
  render(i);
}
const dialog = el<HTMLDialogElement>('restart-dialog');
el('restart').addEventListener('click', () => { dialog.returnValue = ''; dialog.showModal(); });
dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'restart') { saved = { version: 1, game: initialGame(), from: null, path: [] }; warning = ''; render(); }
});
el('help').addEventListener('click', () => { const details = el<HTMLDetailsElement>('instructions'); details.open = !details.open; if (details.open) details.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });
const contrast = el<HTMLInputElement>('contrast');
try { contrast.checked = localStorage.getItem('damas-spanish.contrast') === 'true'; } catch { /* Storage is optional. */ }
function setContrast() { document.body.classList.toggle('high-contrast', contrast.checked); }
setContrast();
contrast.addEventListener('change', () => { setContrast(); try { localStorage.setItem('damas-spanish.contrast', String(contrast.checked)); } catch { /* The current setting still applies. */ } });
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(() => { el('offline-status').textContent = 'Juego preparado para abrirse sin conexión.'; }).catch(() => { el('offline-status').textContent = 'No se ha podido preparar el modo sin conexión.'; });
} else el('offline-status').textContent = 'El navegador no permite instalar el modo sin conexión.';
render();
