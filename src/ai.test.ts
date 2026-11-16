import { expect, it } from 'vitest';
import { chooseEasyMove } from './ai';
import { applyMove, initialGame, legalMoves, positionKey, type Board, type Game } from './engine';
function position(): Game {
  const board: Board = Array(64).fill(null);
  board[18] = { color: 'white', king: false };
  board[27] = { color: 'black', king: false };
  board[54] = { color: 'white', king: false };
  board[0] = { color: 'black', king: true };
  return {board, turn:'white', positions:[positionKey(board,'white')]};
}
it('elige únicamente movimientos legales, sin mutar la posición', () => {
  const game = position(), before = JSON.stringify(game), legal = legalMoves(game);
  for (let i = 0; i <= 100; i++) {
    const move = chooseEasyMove(game, legal, () => i/100);
    expect(legal).toContainEqual(move);
    expect(() => applyMove(game,move)).not.toThrow();
  }
  expect(JSON.stringify(game)).toBe(before);
});
it('no es una elección uniforme: prioriza la coronación y conserva otras opciones', () => {
  const game = position(), legal = legalMoves(game);
  const counts = new Map<string,number>();
  for (let i = 0; i < 1000; i++) {
    const move = chooseEasyMove(game,legal,() => (i+.5)/1000);
    const key = JSON.stringify(move); counts.set(key,(counts.get(key) ?? 0)+1);
  }
  const promotion = legal.find(m => m.from === 54)!;
  const quiet = legal.find(m => m.from === 18 && !m.captures.length)!;
  expect(counts.get(JSON.stringify(promotion))!).toBeGreaterThan(counts.get(JSON.stringify(quiet))!);
  expect(counts.size).toBe(legal.length);
});
it('puede ignorar una captura y también elegir capturar', () => {
  const game=position(), moves=legalMoves(game);
  const choices=Array.from({length:100},(_,i)=>chooseEasyMove(game,moves,()=>i/100));
  expect(choices.some(m=>m.captures.length>0)).toBe(true);
  expect(choices.some(m=>!m.captures.length)).toBe(true);
});
it('rechaza un turno humano y una partida terminada', () => {
  expect(()=>chooseEasyMove(initialGame())).toThrow();
  const game=position(); game.board.fill(null);
  expect(()=>chooseEasyMove(game)).toThrow();
});
it('es reproducible con una fuente de variación fija', () => {
  const game=position();
  expect(chooseEasyMove(game,undefined,()=>.42)).toEqual(chooseEasyMove(game,undefined,()=>.42));
});
