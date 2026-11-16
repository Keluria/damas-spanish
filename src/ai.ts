import { COMPUTER_COLOR, legalMoves, outcome, type Game, type Move } from './engine';

/** One cheap positional pass; no search tree, worker or network is needed. */
export function chooseEasyMove(
  game: Readonly<Game>,
  moves: readonly Move[] = legalMoves(game),
  random: () => number = Math.random
): Move {
  if (game.turn !== COMPUTER_COLOR || outcome(game) || !moves.length) throw new Error('No hay turno del iPad disponible');
  const ranked = moves.map(move => {
    const piece = game.board[move.from]!;
    const destination = move.path.at(-1)!;
    const row = Math.floor(destination / 8), column = destination % 8;
    const promotion = !piece.king && row === 7 ? 2 : 0;
    const captured = move.captures.reduce((score, square) => score + (game.board[square]?.king ? 1.8 : 1.2), 0);
    const centre = (3.5 - Math.abs(3.5 - column)) * .12;
    const progress = piece.king ? 0 : (row - Math.floor(move.from / 8)) * .08;
    return { move, weight: 1 + captured + promotion + centre + progress };
  }).sort((a, b) => b.weight - a.weight);
  // All legal options retain positive weight, including quiet moves and short chains.
  let choice = Math.max(0, Math.min(1, random())) * ranked.reduce((sum, item) => sum + item.weight, 0);
  for (const item of ranked) {
    choice -= item.weight;
    if (choice < 0) return item.move;
  }
  return ranked.at(-1)!.move;
}
