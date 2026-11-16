import { candidates } from './interaction';
import type { SavedGame } from './storage';

const squareName = (i: number) => `${'abcdefgh'[i % 8]}${8 - Math.floor(i / 8)}`;
/** A transient native dialog: touch, keyboard and VoiceOver use the same choices. */
export function routePicker(dialog: HTMLDialogElement) {
  return (saved: SavedGame, target: number, paths: number[][]): Promise<number[] | undefined> => {
    dialog.querySelector('#route-title')!.textContent = `Elige cómo llegar a ${squareName(target)}`;
    const options = dialog.querySelector('#route-options')!;
    options.replaceChildren();
    paths.forEach((path, index) => {
      const move = candidates(saved).find(m => [...saved.path, ...path].every((p, i) => m.path[i] === p))!;
      const victims = move.captures.slice(saved.path.length, saved.path.length + path.length);
      const button = document.createElement('button');
      button.value = String(index);
      const title = document.createElement('span');
      title.textContent = !path.length ? (saved.path.length ? 'Terminar turno aquí' : 'Deseleccionar ficha') : victims.length ? `Capturar ${victims.length} ${victims.length === 1 ? 'ficha' : 'fichas'}` : 'Mover sin capturar';
      const detail = document.createElement('small');
      detail.textContent = !path.length ? 'No realizar más capturas.' : `Recorrido: ${path.map(squareName).join(' → ')}.${victims.length ? ` Captura: ${victims.map(squareName).join(', ')}.` : ''}`;
      button.append(title, detail); options.append(button);
    });
    dialog.returnValue = 'cancel';
    return new Promise(resolve => {
      dialog.addEventListener('close', () => {
        const index = Number(dialog.returnValue);
        resolve(dialog.returnValue !== 'cancel' && Number.isInteger(index) ? paths[index] : undefined);
      }, { once: true });
      dialog.showModal();
    });
  };
}
