import './style.css';
import { animatedInput, animatePiece } from './animation';
import { legalMoves, outcome, type Board } from './engine';
import { candidates } from './interaction';
import { loadGame, saveGame } from './storage';
import { initialGame } from './engine';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const loaded = loadGame();
let saved = loaded.saved;
let warning = loaded.warning;
const boardEl = el('board');
const name = (color: string) => color === 'white' ? 'blancas' : 'negras';
const squareName = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
function persist(next = saved) {
  const notice = saveGame(next) ? warning : 'No se puede guardar. Mantén esta ventana abierta para conservar la partida.';
  el('save-status').textContent = notice;
  el('save-status').hidden = !notice;
}
function render(focus?: number) {
  const end = outcome(saved.game);
  const moves = end ? [] : legalMoves(saved.game);
  const next = new Set(candidates(saved).filter(m => m.path.length > saved.path.length).map(m => m.path[saved.path.length]));
  const current = saved.path.at(-1) ?? saved.from;
  const board: Board = saved.game.board.slice();
  if (saved.from !== null && saved.path.length) {
    const piece = board[saved.from]; board[saved.from] = null;
    candidates(saved)[0]?.captures.slice(0, saved.path.length).forEach(i => { board[i] = null; });
    board[current!] = piece;
  }
  el('status').textContent = end ? ('winner' in end ? `Ganan las ${name(end.winner)}` : 'Tablas por repetición') : `Turno de las ${name(saved.game.turn)}`;
  el('hint').textContent = end ? 'Puedes empezar una nueva partida.' : saved.path.length ? 'Toca tu ficha para terminar o una casilla marcada para seguir.' : saved.from !== null ? 'Ahora toca una casilla marcada.' : 'Toca una ficha para moverla.';
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
      button.setAttribute('aria-label', `${squareName(i)}: ${piece ? `${piece.king ? 'dama' : 'ficha'} ${name(piece.color)}` : 'vacía'}${next.has(i) ? ', destino permitido' : movable ? ', puede mover' : ''}${i === current ? (saved.path.length ? ', toca para terminar el turno' : ', seleccionada') : ''}`);
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
  if (focus !== undefined) boardEl.querySelector<HTMLButtonElement>(`[data-square="${focus}"]`)?.focus({ preventScroll: true });
}
const input = animatedInput({
  current: () => saved,
  persist,
  present: (next, focus) => { saved = next; render(focus); },
  animate: move => animatePiece(boardEl, move),
  setBusy: busy => {
    boardEl.setAttribute('aria-busy', String(busy));
    el<HTMLButtonElement>('restart').disabled = busy;
  }
});
function click(i: number) { void input.tap(i); }
const dialog = el<HTMLDialogElement>('restart-dialog');
el('restart').addEventListener('click', () => { if (input.busy) return; dialog.returnValue = ''; dialog.showModal(); });
dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'restart') { saved = { version: 1, game: initialGame(), from: null, path: [] }; warning = ''; persist(); render(); }
});
persist();
render();
