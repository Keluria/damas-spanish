import './style.css';
import { animatedInput, animatePiece } from './animation';
import { legalMoves, outcome, type Board } from './engine';
import { candidates } from './interaction';
import { loadGame, saveGame } from './storage';
import { ipadOpponent } from './opponent';
import { resultScreen } from './result';
import { renderCaptured } from './captured';
import { captureAnimations } from './capture-animation';
import { installDragging } from './drag';
import { commitDrag } from './drag-model';
import type { SavedGame } from './storage';
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const loaded = loadGame();
let saved = loaded.saved;
let warning = loaded.warning;
const boardEl = el('board');
const capturedEl = el('captured');
const captureMotion = captureAnimations(boardEl, capturedEl);
const name = (color: string) => color === 'white' ? 'blancas' : 'negras';
const squareName = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
function persist(next = saved) {
  const notice = saveGame(next) ? warning : 'No se puede guardar. Mantén esta ventana abierta para conservar la partida.';
  el('save-status').textContent = notice;
  el('save-status').hidden = !notice;
}
let moving = false;
let dragging = false;
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
function render(focus?: number, restoring = false, display: SavedGame = saved) {
  const end = outcome(display.game);
  const moves = end ? [] : legalMoves(display.game);
  const humanTurn = display.game.turn === 'white';
  boardEl.setAttribute('aria-disabled', String(!humanTurn || !!end));
  const next = new Set((humanTurn ? candidates(display) : []).filter(m => m.path.length > display.path.length).map(m => m.path[display.path.length]));
  const current = display.path.at(-1) ?? display.from;
  const board: Board = display.game.board.slice();
  if (display.from !== null && display.path.length) {
    const piece = board[display.from]; board[display.from] = null;
    candidates(display)[0]?.captures.slice(0, display.path.length).forEach(i => { board[i] = null; });
    board[current!] = piece;
  }
  if (!end) {
    el('status').textContent = humanTurn ? 'Tu turno · blancas' : 'Turno del iPad · negras';
    el('hint').textContent = !humanTurn ? 'El iPad mueve las fichas negras. Espera un momento.' : display.path.length ? 'Toca tu ficha para terminar o una casilla marcada para seguir.' : display.from !== null ? 'Ahora toca una casilla marcada.' : 'Toca una ficha para moverla.';
  }
  el('turn-piece').className = `piece ${display.game.turn}`;
  renderCaptured(capturedEl, display.captured ?? []);
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
      if (!end && humanTurn && (display.path.length ? i === current && next.size > 0 : moves.some(move => move.from === i))) {
        button.dataset.draggable = 'true';
      }
      button.setAttribute('aria-pressed', String(i === current));
      const piece = board[i];
      const movable = humanTurn && !end && !display.path.length && moves.some(m => m.from === i);
      button.setAttribute('aria-label', `${squareName(i)}: ${piece ? `${piece.king ? 'dama' : 'ficha'} ${name(piece.color)}` : 'vacía'}${next.has(i) ? ', destino permitido' : movable ? ', puede mover' : ''}${i === current ? (humanTurn && display.path.length ? ', toca para terminar el turno' : ', seleccionada') : ''}`);
      if (piece) {
        const token = document.createElement('span');
        token.className = `piece ${piece.color}${movable ? ' movable' : ''}`;
        token.setAttribute('aria-hidden', 'true');
        token.textContent = piece.king ? '♛' : '';
        button.append(token);
      }
      if (next.has(i)) { const dot = document.createElement('span'); dot.className = 'marker'; dot.setAttribute('aria-hidden', 'true'); cell.append(dot); }
    } else cell.setAttribute('aria-hidden', 'true');
    boardEl.append(cell);
  }
  if (!end && focus !== undefined) boardEl.querySelector<HTMLButtonElement>(`[data-square="${focus}"]`)?.focus({ preventScroll: true });
  result.update(display.game, moving, restoring);
}
const input = animatedInput({
  current: () => saved,
  persist,
  present: (next, focus) => { const humanTurn = saved.game.turn === 'white'; saved = next; render(humanTurn ? focus : undefined); },
  animate: move => animatePiece(boardEl, move),
  capture: (move, next, animated) => captureMotion.transfer(move, next, animated),
  setBusy: busy => {
    if (busy) captureMotion.begin(); else captureMotion.end();
    moving = busy;
    boardEl.setAttribute('aria-busy', String(busy));
    el<HTMLButtonElement>('restart').disabled = busy || dragging;
    if (!busy) result.update(saved.game);
  }
});
const opponent = ipadOpponent({
  current: () => saved,
  tap: (square, options) => input.tap(square, options),
  busy: () => input.busy,
  replace: next => { saved = next; warning = ''; persist(); render(); }
});
const drag = installDragging(boardEl, {
  current: () => saved,
  canInput: () => !moving && !dragging && !result.finished && saved.game.turn === 'white' && !dialog.open,
  preview: next => render(undefined, false, next),
  restore: focus => render(focus),
  commit: (source, destination) => commitDrag(saved, source, destination, opponent.humanTap),
  tap: square => { void opponent.humanTap(square); },
  setBusy: busy => { dragging = busy; el<HTMLButtonElement>('restart').disabled = busy || moving; }
});
const dialog = el<HTMLDialogElement>('restart-dialog');
el('restart').addEventListener('click', () => {
  if (input.busy || dragging) return;
  drag.cancel();
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
