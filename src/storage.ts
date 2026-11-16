import { initialGame, legalMoves, positionKey, type Game, type Piece } from './engine';
export interface SavedGame { version: 2; game: Game; from: number | null; path: number[]; captured?: Piece[] }
const key = 'damas-spanish.game.v1';
export function validateSaved(value: unknown): value is SavedGame {
  if (!value || typeof value !== 'object') return false;
  const s = value as SavedGame;
  if (s.version !== 2 || !s.game || !Array.isArray(s.path)) return false;
  if (s.captured !== undefined && (!Array.isArray(s.captured) || s.captured.length > 24 ||
    !s.captured.every(p => p && typeof p === 'object' && ['white', 'black'].includes(p.color) && typeof p.king === 'boolean') ||
    ['white', 'black'].some(color => s.captured!.filter(p => p.color === color).length > 12))) return false;
  const g = s.game;
  if (!Array.isArray(g.board) || g.board.length !== 64 || !['white', 'black'].includes(g.turn)) return false;
  if (!g.board.every((p, i) => p === null || (p && typeof p === 'object' && ['white', 'black'].includes(p.color) && typeof p.king === 'boolean' && (Math.floor(i / 8) + i % 8) % 2 === 0))) return false;
  if (['white', 'black'].some(c => g.board.filter(p => p?.color === c).length > 12)) return false;
  if (!Array.isArray(g.positions) || !g.positions.length || g.positions.length > 10000 || !g.positions.every(p => typeof p === 'string' && /^(white|black):[.wWbB]{64}$/.test(p))) return false;
  if (g.positions.at(-1) !== positionKey(g.board, g.turn)) return false;
  if (s.from === null) return s.path.length === 0;
  return Number.isInteger(s.from) && s.path.every(Number.isInteger) && legalMoves(g).some(m => m.from === s.from && s.path.length < m.path.length && s.path.every((p, i) => p === m.path[i]));
}
export function loadGame(): { saved: SavedGame; warning: string } {
  const fresh: SavedGame = { version: 2, game: initialGame(), from: null, path: [] };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { saved: fresh, warning: '' };
    const saved: unknown = migrateLegacy(JSON.parse(raw));
    if (!validateSaved(saved)) throw new Error('Invalid save');
    return { saved, warning: '' };
  } catch { return { saved: fresh, warning: 'No se pudo recuperar la partida anterior. Se ha preparado una nueva.' }; }
}
export function saveGame(saved: SavedGame): boolean {
  try { localStorage.setItem(key, JSON.stringify(saved)); return true; }
  catch { return false; }
}

/** v1 used human white below; swap colors, never positions or player ownership. */
export function migrateLegacy(value: unknown): unknown {
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1) return value;
  const old = value as Record<string, unknown>;
  if (!old.game || typeof old.game !== 'object') return value;
  const game = old.game as Record<string, unknown>;
  if (!Array.isArray(game.board) || !Array.isArray(game.positions)) return value;
  const swap = (color: unknown) => color === 'white' ? 'black' : color === 'black' ? 'white' : color;
  const piece = (p: unknown) => p && typeof p === 'object' && 'color' in p ? { ...p, color: swap(p.color) } : p;
  const position = (p: unknown) => typeof p === 'string' && /^(white|black):[.wWbB]{64}$/.test(p)
    ? swap(p.split(':')[0]) + ':' + p.split(':')[1].replace(/[wWbB]/g, c => ({ w: 'b', W: 'B', b: 'w', B: 'W' })[c]!) : p;
  return { ...old, version: 2, game: { ...game, board: game.board.map(piece),
    turn: swap(game.turn), positions: game.positions.map(position) },
    ...(Array.isArray(old.captured) ? { captured: old.captured.map(piece) } : {}) };
}
