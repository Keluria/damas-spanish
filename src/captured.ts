import type { Piece } from './engine';
import type { SavedGame } from './storage';

/** Only actual captures are recorded; old saves never invent missing pieces. */
export function recordCapture(saved: SavedGame, square: number): SavedGame {
  const piece = saved.game.board[square];
  if (!piece) throw new Error('No existe la ficha capturada');
  return { ...saved, captured: [...(saved.captured ?? []), { ...piece }] };
}
export function renderCaptured(tray: HTMLElement, captured: readonly Piece[]) {
  tray.replaceChildren();
  for (const color of ['black', 'white'] as const) {
    const row = document.createElement('div');
    row.className = 'captured-row'; row.setAttribute('role', 'list');
    row.setAttribute('aria-label', color === 'black' ? 'Fichas negras capturadas' : 'Fichas blancas capturadas');
    const pieces = captured.filter(piece => piece.color === color);
    for (let i = 0; i < 12; i++) {
      const slot = document.createElement('div');
      slot.className = 'captured-slot'; slot.dataset.capturedSlot = `${color}-${i}`;
      const piece = pieces[i];
      if (piece) {
        const token = document.createElement('span');
        token.className = `piece ${color}`; token.textContent = piece.king ? '♛' : '';
        slot.setAttribute('role', 'listitem');
        slot.setAttribute('aria-label', `${piece.king ? 'Dama' : 'Ficha'} ${color === 'white' ? 'blanca' : 'negra'} capturada`);
        token.setAttribute('aria-hidden', 'true'); slot.append(token);
      }
      row.append(slot);
    }
    tray.append(row);
  }
}
