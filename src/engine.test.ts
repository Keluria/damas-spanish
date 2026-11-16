import { describe, it, expect } from 'vitest';
import { applyMove, initialGame, legalMoves, outcome, positionKey, type Game, type Piece } from './engine';
const w: Piece = { color: 'white', king: false }, b: Piece = { color: 'black', king: false };
const W: Piece = { ...w, king: true }, B: Piece = { ...b, king: true };
function game(pieces: Record<number, Piece>, turn: 'white' | 'black' = 'white'): Game {
  const board = Array(64).fill(null);
  Object.entries(pieces).forEach(([i, p]) => { board[Number(i)] = p; });
  return { board, turn, positions: [positionKey(board, turn)] };
}
describe('posición y movimientos', () => {
  it('inicia con 12 fichas por color y blancas al turno', () => {
    const g = initialGame();
    expect(g.board.filter(p => p?.color === 'white')).toHaveLength(12);
    expect(g.board.filter(p => p?.color === 'black')).toHaveLength(12);
    expect(g.turn).toBe('white'); expect(legalMoves(g)).toHaveLength(7);
  });
  it('los peones blancos solo avanzan una casilla', () => {
    expect(legalMoves(game({ 36: w })).map(m => m.path)).toEqual([[27], [29]]);
  });
  it('los peones negros avanzan en sentido opuesto', () => {
    expect(legalMoves(game({ 27: b }, 'black')).map(m => m.path)).toEqual([[34], [36]]);
  });
  it('una dama vuela en las cuatro diagonales sin saltar fichas propias', () => {
    const moves = legalMoves(game({ 36: W, 18: w }));
    expect(moves.some(m => m.from === 36 && m.path[0] === 0)).toBe(false);
    for (const target of [27, 15, 57, 63]) expect(moves.some(m => m.from === 36 && m.path[0] === target)).toBe(true);
  });
  it('rechaza un movimiento ilegal y no modifica el original', () => {
    const g = initialGame(), before = JSON.stringify(g);
    expect(() => applyMove(g, { from: 40, path: [24], captures: [] })).toThrow();
    applyMove(g, legalMoves(g)[0]); expect(JSON.stringify(g)).toBe(before);
  });
});
describe('capturas opcionales', () => {
  it('permite capturar, mover esa ficha sin capturar o mover otra ficha', () => {
    const g = game({ 36: w, 27: b, 54: w, 0: b });
    const capture = { from: 36, path: [18], captures: [27] };
    expect(legalMoves(g)).toContainEqual(capture);
    expect(legalMoves(g)).toContainEqual({ from: 36, path: [29], captures: [] });
    const other = { from: 54, path: [47], captures: [] };
    expect(legalMoves(g)).toContainEqual(other);
    expect(applyMove(g, other).board[27]).toEqual(b);
    const next = applyMove(g, capture);
    expect(next.board[27]).toBeNull(); expect(next.board[18]).toEqual(w); expect(next.turn).toBe('black');
  });
  it('el peón no captura hacia atrás', () => {
    expect(legalMoves(game({ 36: w, 45: b })).every(m => m.captures.length === 0)).toBe(true);
  });
  it('permite terminar después del primer salto o completar la captura múltiple', () => {
    const g = game({ 54: w, 45: b, 27: b });
    expect(legalMoves(g)).toContainEqual({ from: 54, path: [36, 18], captures: [45, 27] });
    const next = applyMove(g, { from: 54, path: [36], captures: [45] });
    expect(next.board[36]).toEqual(w); expect(next.board[27]).toEqual(b);
    expect(next.turn).toBe('black');
  });
  it('la dama elige entre casillas libres tras la víctima', () => {
    expect(legalMoves(game({ 54: W, 36: b })).filter(m => m.captures.length).map(m => m.path)).toEqual([[27], [18], [9], [0]]);
  });
  it('las víctimas permanecen como obstáculos y no se capturan dos veces', () => {
    const moves = legalMoves(game({ 36: W, 27: b, 45: b }));
    expect(moves.filter(m => m.captures.length).every(m => m.captures.length === 1)).toBe(true);
  });
  it('no salta dos adversarios contiguos', () => {
    expect(legalMoves(game({ 54: W, 45: b, 36: b })).every(m => m.captures.length === 0)).toBe(true);
  });
  it('no prioriza capturas más largas', () => {
    const moves = legalMoves(game({ 54: w, 45: b, 27: b, 50: w, 41: B }));
    expect(moves).toContainEqual({ from: 54, path: [36, 18], captures: [45, 27] });
    expect(moves).toContainEqual({ from: 50, path: [32], captures: [41] });
    expect(moves).toContainEqual({ from: 54, path: [36], captures: [45] });
  });
  it('no prioriza capturar damas frente a peones', () => {
    const moves = legalMoves(game({ 54: w, 45: b, 50: w, 41: B }));
    expect(moves).toContainEqual({ from: 50, path: [32], captures: [41] });
    expect(moves).toContainEqual({ from: 54, path: [36], captures: [45] });
  });
  it('conserva todas las alternativas de captura', () => {
    expect(legalMoves(game({ 54: w, 45: b, 50: w, 41: b })).filter(m => m.captures.length)).toHaveLength(2);
  });
});
describe('coronación y final', () => {
  it('corona al mover hasta la última fila', () => {
    const g = game({ 9: w, 63: b });
    expect(applyMove(g, legalMoves(g)[0]).board[0]?.king).toBe(true);
  });
  it('corona tras capturar sin continuar como dama en ese turno', () => {
    const g = game({ 18: w, 9: b, 27: b });
    const move = legalMoves(g)[0]; expect(move.path).toEqual([0]);
    expect(applyMove(g, move).board[0]?.king).toBe(true);
  });
  it('corona negras en la fila inferior', () => {
    const g = game({ 54: b, 0: w }, 'black');
    expect(applyMove(g, legalMoves(g)[0]).board[61]?.king).toBe(true);
  });
  it('declara victoria por falta de fichas o bloqueo', () => {
    expect(outcome(game({ 0: b }))).toEqual({ winner: 'black' });
    expect(outcome(game({ 0: w, 63: b }))).toEqual({ winner: 'black' });
  });
  it('declara tablas a la tercera repetición con el mismo turno', () => {
    const g = game({ 0: W, 63: B });
    g.positions = Array(3).fill(positionKey(g.board, g.turn));
    expect(outcome(g)).toEqual({ draw: true });
    expect(() => applyMove(g, legalMoves(g)[0])).toThrow();
  });
  it('reinicia el historial tras un avance de peón', () => {
    const g = game({ 36: w, 0: b });
    expect(applyMove(g, legalMoves(g)[0]).positions).toHaveLength(1);
  });
});

it('mantiene las invariantes durante una partida determinista de hasta 160 turnos', () => {
  let g = initialGame();
  for (let turn = 0; turn < 160 && !outcome(g); turn++) {
    const moves = legalMoves(g);
    const move = moves[(turn * 17 + 3) % moves.length];
    const before = g.board.filter(Boolean).length;
    const previous = g.turn;
    g = applyMove(g, move);
    expect(g.board.filter(Boolean)).toHaveLength(before - move.captures.length);
    expect(g.turn).not.toBe(previous);
    expect(g.board.every((p, i) => !p || (Math.floor(i / 8) + i % 8) % 2 === 0)).toBe(true);
    expect(g.positions.at(-1)).toBe(positionKey(g.board, g.turn));
  }
});

it('permite parar también tras el segundo salto de una cadena de tres', () => {
  const g = game({ 54: w, 45: b, 27: b, 9: b });
  const stopped = applyMove(g, { from: 54, path: [36, 18], captures: [45, 27] });
  expect(stopped.board[18]).toEqual(w); expect(stopped.board[9]).toEqual(b);
  expect(stopped.turn).toBe('black');
  const completed = applyMove(g, { from: 54, path: [36, 18, 0], captures: [45, 27, 9] });
  expect(completed.board[0]).toEqual(W);
});

it('las negras también pueden ignorar una captura disponible', () => {
  const g = game({ 18: b, 27: w, 0: b }, 'black');
  expect(legalMoves(g)).toContainEqual({ from: 18, path: [36], captures: [27] });
  const next = applyMove(g, { from: 0, path: [9], captures: [] });
  expect(next.board[27]).toEqual(w); expect(next.turn).toBe('white');
  expect(() => applyMove(g, { from: 18, path: [9], captures: [] })).toThrow();
});
