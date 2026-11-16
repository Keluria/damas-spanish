import { expect, it } from 'vitest';
import { initialGame, legalMoves, applyMove, positionKey, HUMAN_COLOR, COMPUTER_COLOR, type Game } from './engine';
import { chooseEasyMove } from './ai';
it('empieza siempre el humano negro con doce fichas abajo y doce blancas arriba', () => {
  const game = initialGame(); expect(HUMAN_COLOR).toBe('black'); expect(COMPUTER_COLOR).toBe('white');
  expect(game.turn).toBe('black');
  expect(game.board.slice(0,24).filter(p => p?.color === 'white')).toHaveLength(12);
  expect(game.board.slice(40).filter(p => p?.color === 'black')).toHaveLength(12);
  for (const move of legalMoves(game)) expect(move.path[0]).toBeLessThan(move.from);
});
it.each([{ color:'black' as const, from:18, victim:9, to:0 }, { color:'white' as const, from:45, victim:54, to:63 }])('orienta y corona $color correctamente', ({ color, from, victim, to }) => {
  const board = Array(64).fill(null); board[from] = { color, king:false }; board[victim] = { color:color === 'black' ? 'white' : 'black',king:false };
  const game: Game = { board,turn:color,positions:[positionKey(board,color)] };
  const move = legalMoves(game).find(m => m.captures[0] === victim)!;
  expect(move.path).toEqual([to]); expect(applyMove(game,move).board[to]).toEqual({ color,king:true });
});
it('la IA solo elige movimientos blancos y avanza hacia abajo', () => {
  const game = initialGame(); expect(() => chooseEasyMove(game)).toThrow();
  const next = applyMove(game, legalMoves(game)[0]);
  const move = chooseEasyMove(next, undefined, () => 0);
  expect(next.turn).toBe('white'); expect(next.board[move.from]?.color).toBe('white');
  expect(move.path[0]).toBeGreaterThan(move.from); expect(legalMoves(next)).toContainEqual(move);
});
