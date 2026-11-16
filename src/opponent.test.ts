import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { animatedInput, type Cleanup, type VisualMove } from './animation';
import { ipadOpponent } from './opponent';
import { applyMove, initialGame, legalMoves, positionKey, type Board, type Move } from './engine';
import { loadGame, saveGame, type SavedGame } from './storage';
import { tapSquare } from './interaction';

beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
function initial():SavedGame {return {version:1,game:initialGame(),from:null,path:[]};}
function blackChain():SavedGame {
  const board:Board=Array(64).fill(null);
  board[18]={color:'black',king:false};
  board[27]=board[45]=board[63]={color:'white',king:false};
  return {version:1,game:{board,turn:'black',positions:[positionKey(board,'black')]},from:null,path:[]};
}
function harness(start=initial(), choose=(_state:SavedGame,moves:readonly Move[])=>moves[0]) {
  let state=start, blocked=false;
  let raw:string|null=null;
  vi.stubGlobal('localStorage',{setItem:(_key:string,value:string)=>{raw=value;},getItem:()=>raw});
  const animate=vi.fn(async (_move:VisualMove):Promise<Cleanup|void>=>{});
  const persist=vi.fn(saveGame);
  const chooseSpy=vi.fn(choose);
  const input=animatedInput({current:()=>state,persist,present:next=>{state=next;},animate,setBusy:busy=>{blocked=busy;}});
  const replace=vi.fn((next:SavedGame)=>{state=next;saveGame(state);});
  const opponent=ipadOpponent({current:()=>state,tap:input.tap,busy:()=>blocked,replace,choose:chooseSpy});
  return {opponent,input,animate,persist,choose:chooseSpy,replace,state:()=>state};
}
async function humanMove(h:ReturnType<typeof harness>) {await h.opponent.humanTap(41);await h.opponent.humanTap(32);}

it('empieza siempre con blancas y no responde hasta que termina el turno humano', async()=>{
  const h=harness();h.opponent.resume();
  await vi.advanceTimersByTimeAsync(2000);expect(h.choose).not.toHaveBeenCalled();
  await h.opponent.humanTap(41);await vi.advanceTimersByTimeAsync(2000);
  expect(h.choose).not.toHaveBeenCalled();
  await h.opponent.humanTap(32);expect(h.state().game.turn).toBe('black');
  await vi.advanceTimersByTimeAsync(649);expect(h.choose).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);expect(h.choose).toHaveBeenCalledTimes(1);
  expect(h.state().game.turn).toBe('white');
  expect(h.animate).toHaveBeenCalledTimes(2); // Human and machine share the same animation input.
});
it('ignora las fichas negras en turno humano y todos los toques en turno máquina',async()=>{
  const h=harness(),original=h.state();await h.opponent.humanTap(16);expect(h.state()).toBe(original);
  await humanMove(h);const black=h.state();
  await h.opponent.humanTap(16);await h.opponent.humanTap(25);expect(h.state()).toBe(black);
});
it('no duplica la respuesta al reanudar varias veces o pulsar rápidamente',async()=>{
  const h=harness();await humanMove(h);
  for(let i=0;i<10;i++){h.opponent.resume();await h.opponent.humanTap(18);}
  await vi.advanceTimersByTimeAsync(5000);
  expect(h.choose).toHaveBeenCalledTimes(1);expect(h.state().game.turn).toBe('white');
});
it('el turno del iPad se guarda y coincide con aplicar su movimiento legal',async()=>{
  const h=harness();await humanMove(h);const before=h.state();const expected=applyMove(before.game,legalMoves(before.game)[0]);
  await vi.advanceTimersByTimeAsync(650);
  expect(h.state().game).toEqual(expected);expect(loadGame().saved).toEqual(h.state());
});
it('Nueva partida cancela la respuesta pendiente y devuelve el turno al humano',async()=>{
  const h=harness();await humanMove(h);expect(h.opponent.newGame()).toBe(true);
  await vi.advanceTimersByTimeAsync(1000);
  expect(h.state()).toEqual(initial());expect(h.choose).not.toHaveBeenCalled();
  expect(loadGame().saved).toEqual(initial());
});
it('la confirmación puede suspender la espera y reanudar sin reiniciar',async()=>{
  const h=harness();await humanMove(h);const before=h.state();
  h.opponent.suspend();await vi.advanceTimersByTimeAsync(2000);expect(h.state()).toBe(before);
  h.opponent.resume();await vi.advanceTimersByTimeAsync(650);
  expect(h.choose).toHaveBeenCalledTimes(1);expect(h.state().game.turn).toBe('white');
});
it('restaura un turno negro y responde una sola vez sin toque humano',async()=>{
  const start=tapSquare(tapSquare(initial(),41),32);
  const h=harness(start);saveGame(start);
  const restored=harness(loadGame().saved);restored.opponent.resume();
  await vi.advanceTimersByTimeAsync(650);
  expect(restored.state().game.turn).toBe('white');expect(restored.choose).toHaveBeenCalledTimes(1);
});
it('una cadena humana opcional no dispara la IA hasta que decide terminar',async()=>{
  const board:Board=Array(64).fill(null);board[54]={color:'white',king:false};board[45]=board[27]={color:'black',king:false};
  const h=harness({version:1,game:{board,turn:'white',positions:[positionKey(board,'white')]},from:null,path:[]});
  await h.opponent.humanTap(54);await h.opponent.humanTap(36);
  await vi.advanceTimersByTimeAsync(2000);expect(h.choose).not.toHaveBeenCalled();
  await h.opponent.humanTap(36);expect(h.state().game.turn).toBe('black');
  await vi.advanceTimersByTimeAsync(650);expect(h.choose).toHaveBeenCalledTimes(1);
});
it('la máquina puede terminar su captura después del primer salto',async()=>{
  const start=blackChain(),h=harness(start,(_s,moves)=>moves.find(m=>m.captures.length===1)!);
  h.opponent.resume();await vi.advanceTimersByTimeAsync(650);
  expect(h.state().game).toEqual(applyMove(start.game,{from:18,path:[36],captures:[27]}));
  expect(h.animate.mock.calls.map(([move])=>move)).toEqual([{from:18,to:36,captured:27}]);
});
it('anima cada salto de una cadena completa en el orden correcto',async()=>{
  const start=blackChain(),h=harness(start,(_s,moves)=>moves.find(m=>m.captures.length===2)!);
  h.opponent.resume();await vi.advanceTimersByTimeAsync(650);
  expect(h.state().game).toEqual(applyMove(start.game,{from:18,path:[36,54],captures:[27,45]}));
  expect(h.animate.mock.calls.map(([move])=>move)).toEqual([{from:18,to:36,captured:27},{from:36,to:54,captured:45}]);
});
it('reanuda una captura negra guardada sin repetir el primer salto',async()=>{
  const partial=tapSquare(tapSquare(blackChain(),18),36);
  const h=harness(partial,(_s,moves)=>moves.find(m=>m.path.length===2)!);
  h.opponent.resume();await vi.advanceTimersByTimeAsync(650);
  expect(h.animate.mock.calls.map(([move])=>move)).toEqual([{from:36,to:54,captured:45}]);
  expect(h.state().game.turn).toBe('white');
});
it('una captura restaurada puede terminar sin otro desplazamiento',async()=>{
  const partial=tapSquare(tapSquare(blackChain(),18),36);
  const h=harness(partial,(_s,moves)=>moves.find(m=>m.path.length===1)!);
  h.opponent.resume();await vi.advanceTimersByTimeAsync(650);
  expect(h.animate).not.toHaveBeenCalled();expect(h.state().game.turn).toBe('white');
});
it('no permite reiniciar ni tocar durante un salto y recupera el guardado adelantado',async()=>{
  const h=harness(blackChain(),(_s,moves)=>moves.find(m=>m.path.length===2)!);
  let land!:()=>void;h.animate.mockImplementationOnce(()=>new Promise<void>(resolve=>{land=resolve;}));
  h.opponent.resume();await vi.advanceTimersByTimeAsync(650);
  expect(h.input.busy).toBe(true);expect(h.opponent.newGame()).toBe(false);
  const visible=h.state();await h.opponent.humanTap(63);expect(h.state()).toBe(visible);
  expect(loadGame().saved.path).toEqual([36]); // Reload during the first animated jump.
  h.opponent.suspend();land();await vi.advanceTimersByTimeAsync(0);
  expect(h.state().path).toEqual([36]);expect(h.animate).toHaveBeenCalledTimes(1);
  h.opponent.resume();await vi.advanceTimersByTimeAsync(650);
  expect(h.state().game.turn).toBe('white');expect(h.animate).toHaveBeenCalledTimes(2);
});
it('no programa respuestas si la partida ya terminó',async()=>{
  const state=blackChain();state.game.board[18]=null;state.game.positions=[positionKey(state.game.board,'black')];
  const h=harness(state);h.opponent.resume();await vi.advanceTimersByTimeAsync(3000);
  expect(h.choose).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
