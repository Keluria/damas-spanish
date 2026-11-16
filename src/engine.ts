/** Motor puro: índices fila * 8 + columna; casillas claras jugables. */
export type Color = 'white' | 'black';
export const HUMAN_COLOR: Color = 'black';
export const COMPUTER_COLOR: Color = 'white';
export interface Piece { color: Color; king: boolean }
export type Board = (Piece | null)[];
export interface Move { from: number; path: number[]; captures: number[] }
export interface Game { board: Board; turn: Color; positions: string[] }
export type Outcome = { winner: Color } | { draw: true } | null;
const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const row = (i: number) => Math.floor(i / 8);
const col = (i: number) => i % 8;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
export function positionKey(board: Board, turn: Color): string {
  return turn + ':' + board.map(p => p ? (p.color === 'white' ? (p.king ? 'W' : 'w') : (p.king ? 'B' : 'b')) : '.').join('');
}
export function initialGame(): Game {
  const board: Board = Array(64).fill(null);
  for (let i = 0; i < 64; i++) if ((row(i) + col(i)) % 2 === 0 && (row(i) < 3 || row(i) > 4))
    board[i] = { color: row(i) < 3 ? COMPUTER_COLOR : HUMAN_COLOR, king: false };
  return { board, turn: HUMAN_COLOR, positions: [positionKey(board, HUMAN_COLOR)] };
}
function pieceDirections(piece: Piece) {
  return piece.king ? directions : directions.filter(([dr]) => dr === (piece.color === HUMAN_COLOR ? -1 : 1));
}
function captureSequences(board: Board, from: number, piece: Piece): Move[] {
  const result: Move[] = [];
  function visit(at: number, path: number[], captured: number[]) {
    if (captured.length) result.push({ from, path, captures: captured });
    for (const [dr, dc] of pieceDirections(piece)) {
      let r = row(at) + dr, c = col(at) + dc;
      let victim = -1;
      while (inside(r, c)) {
        const index = r * 8 + c;
        // The moving piece leaves its origin; captured pieces stay as blockers until turn end.
        const occupant = index === from ? null : board[index];
        if (occupant) {
          if (victim !== -1 || occupant.color === piece.color || captured.includes(index)) break;
          victim = index;
        } else if (victim !== -1) {
          visit(index, [...path, index], [...captured, victim]);
          if (!piece.king) break;
        } else if (!piece.king) break;
        if (!piece.king && victim !== -1 && (r !== row(at) + dr || c !== col(at) + dc)) break;
        r += dr; c += dc;
      }
    }
  }
  visit(from, [], []);
  return result;
}
export function legalMoves(game: Pick<Game, 'board' | 'turn'>): Move[] {
  const captures: Move[] = [], quiet: Move[] = [];
  game.board.forEach((piece, from) => {
    if (!piece || piece.color !== game.turn) return;
    captures.push(...captureSequences(game.board, from, piece));
    for (const [dr, dc] of pieceDirections(piece)) {
      let r = row(from) + dr, c = col(from) + dc;
      while (inside(r, c) && !game.board[r * 8 + c]) {
        quiet.push({ from, path: [r * 8 + c], captures: [] });
        if (!piece.king) break;
        r += dr; c += dc;
      }
    }
  });
  // Every capture prefix is a valid stopping point; quiet moves stay available.
  return [...captures, ...quiet];
}
export function outcome(game: Game): Outcome {
  if (!legalMoves(game).length) return { winner: opposite(game.turn) };
  const key = positionKey(game.board, game.turn);
  if (game.positions.filter(p => p === key).length >= 3) return { draw: true };
  return null;
}
export function applyMove(game: Game, move: Move): Game {
  if (outcome(game)) throw new Error('La partida ha terminado');
  const valid = legalMoves(game).find(m => JSON.stringify(m) === JSON.stringify(move));
  if (!valid) throw new Error('Movimiento no permitido');
  const board = game.board.map(p => p && { ...p });
  const piece = board[move.from]!;
  board[move.from] = null;
  move.captures.forEach(i => { board[i] = null; });
  const destination = move.path.at(-1)!;
  // Promotion takes place only after completing the entire move.
  piece.king ||= row(destination) === (piece.color === HUMAN_COLOR ? 0 : 7);
  board[destination] = piece;
  const turn = opposite(game.turn);
  const irreversible = move.captures.length > 0 || !game.board[move.from]!.king;
  return { board, turn, positions: [...(irreversible ? [] : game.positions), positionKey(board, turn)] };
}
/** Future AI consumes the same legal full turns as the local interface. */
export interface MoveProvider { chooseMove(game: Readonly<Game>): Promise<Move> }
