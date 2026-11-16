import './style.css';
import { animatedInput, animatePiece } from './animation';
import { legalMoves, outcome, type Board } from './engine';
import { candidates } from './interaction';
import { loadGame, saveGame } from './storage';
import { ipadOpponent } from './opponent';
import { resultScreen } from './result';
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
let moving = false;
const result = resultScreen({
  show: ({ title, message, celebrate }) => {
    el('play-area').hidden = true;
    el('result-title').textContent = title;
    el('result-message').textContent = message;
    el('result-message').hidden = !message;
    el('result-stars').hidden = !celebrate;
    el('result').classList.toggle('celebrate', celebrate);
    el('result').hidden = false;
    el('result-title').focus();
  },
  hide: () => {
    el('result').hidden = true;
    el('result').classList.remove('celebrate');
    el('play-area').hidden = false;
    el('status').focus({ preventScroll: true });
  }
});
function render(focus?: number, restoring = false) {
  const end = outcome(saved.game);
  const moves = end ? [] : legalMoves(saved.game);
  const humanTurn = saved.game.turn === 'white';
  boardEl.setAttribute('aria-disabled', String(!humanTurn || !!end));
  const next = new Set((humanTurn ? candidates(saved) : []).filter(m => m.path.length > saved.path.length).map(m => m.path[saved.path.length]));
  const current = saved.path.at(-1) ?? saved.from;
  const board: Board = saved.game.board.slice();
  if (saved.from !== null && saved.path.length) {
    const piece = board[saved.from]; board[saved.from] = null;
    candidates(saved)[0]?.captures.slice(0, saved.path.length).forEach(i => { board[i] = null; });
    board[current!] = piece;
  }
  if (!end) {
    el('status').textContent = humanTurn ? 'Tu turno · blancas' : 'Turno del iPad · negras';
    el('hint').textContent = !humanTurn ? 'El iPad mueve las fichas negras. Espera un momento.' : saved.path.length ? 'Toca tu ficha para terminar o una casilla marcada para seguir.' : saved.from !== null ? 'Ahora toca una casilla marcada.' : 'Toca una ficha para moverla.';
  }
  el('turn-piece').className = `piece ${saved.game.turn}`;
  boardEl.replaceChildren();
  for (let i = 0; i < 64; i++) {
    const playable = (Math.floor(i / 8) + i % 8) % 2 === 0;
    const cell = document.createElement(playable ? 'button' : 'div');
    cell.className = `cell ${playable ? 'playable' : 'dark'}${i === current ? ' selected' : ''}${next.has(i) ? ' destination' : ''}`;
    if (playable) {
      const button = cell as HTMLButtonElement;
      button.type = 'button';
      button.setAttribute('aria-disabled', String(!humanTurn || !!end));
      button.dataset.square = String(i);
      button.setAttribute('aria-pressed', String(i === current));
      const piece = board[i];
      const movable = humanTurn && !end && !saved.path.length && moves.some(m => m.from === i);
      button.setAttribute('aria-label', `${squareName(i)}: ${piece ? `${piece.king ? 'dama' : 'ficha'} ${name(piece.color)}` : 'vacía'}${next.has(i) ? ', destino permitido' : movable ? ', puede mover' : ''}${i === current ? (humanTurn && saved.path.length ? ', toca para terminar el turno' : ', seleccionada') : ''}`);
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
  if (!end && focus !== undefined) boardEl.querySelector<HTMLButtonElement>(`[data-square="${focus}"]`)?.focus({ preventScroll: true });
  result.update(saved.game, moving, restoring);
}
const input = animatedInput({
  current: () => saved,
  persist,
  present: (next, focus) => { const humanTurn = saved.game.turn === 'white'; saved = next; render(humanTurn ? focus : undefined); },
  animate: move => animatePiece(boardEl, move),
  setBusy: busy => {
    moving = busy;
    boardEl.setAttribute('aria-busy', String(busy));
    el<HTMLButtonElement>('restart').disabled = busy;
    if (!busy) result.update(saved.game);
  }
});
const opponent = ipadOpponent({
  current: () => saved,
  tap: square => input.tap(square),
  busy: () => input.busy,
  replace: next => { saved = next; warning = ''; persist(); render(); }
});
function click(i: number) { void opponent.humanTap(i); }
const dialog = el<HTMLDialogElement>('restart-dialog');
el('restart').addEventListener('click', () => {
  if (input.busy) return;
  opponent.suspend();
  if (result.finished) {
    opponent.newGame();
    if (!document.hidden) opponent.resume();
  } else {
    dialog.returnValue = '';
    dialog.showModal();
  }
});
dialog.addEventListener('close', () => {
  if (dialog.returnValue === 'restart') opponent.newGame();
  if (!document.hidden) opponent.resume();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden || dialog.open) opponent.suspend();
  else opponent.resume();
});
persist();
render(undefined, true);
if (document.hidden) opponent.suspend();
else opponent.resume();
