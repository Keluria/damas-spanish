import { HUMAN_COLOR, outcome, type Game, type Outcome } from './engine';

export interface ResultMessage {
  title: string;
  message: string;
  celebrate: boolean;
}
interface View {
  show(result: ResultMessage): void;
  hide(): void;
}
function messageFor(result: NonNullable<Outcome>, restoring: boolean): ResultMessage {
  if ('draw' in result) return { title: '¡Tablas! Buena partida', message: '', celebrate: false };
  if (result.winner === HUMAN_COLOR) return { title: '¡Has ganado!', message: '¡Muy bien jugado!', celebrate: !restoring };
  return { title: 'Partida terminada', message: 'Gracias por jugar. Podemos intentarlo otra vez.', celebrate: false };
}

/** One presentation per game, using only the existing engine's outcome. */
export function resultScreen(view: View) {
  let presented = false;
  return {
    get finished() { return presented; },
    update(game: Game, moving = false, restoring = false) {
      const result = outcome(game);
      if (!result) {
        if (presented) { presented = false; view.hide(); }
        return;
      }
      // The landing render happens before animation cleanup; wait until its busy flag clears.
      if (moving || presented) return;
      presented = true;
      view.show(messageFor(result, restoring));
    }
  };
}
