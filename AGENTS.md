# Proyecto: Damas Españolas para iPad

## Objetivo
Desarrollar una PWA de damas españolas para una persona mayor con Alzheimer. Debe funcionar en un iPad de 2019 y poder desarrollarse desde un iPad Pro.

## Tecnología
- HTML, CSS y TypeScript.
- Diseño responsive, táctil y compatible con Safari en iPadOS 18.
- PWA instalable desde Safari.
- Service worker para funcionamiento sin conexión.
- Almacenamiento local para guardar partidas.
- Despliegue mediante GitHub Pages.
- Sin backend obligatorio ni servicios de pago.

## Reglas
- Tablero de 8x8 y 12 fichas por jugador.
- Variante simplificada fija de las damas españolas, adaptada para una persona mayor con Alzheimer.
- Movimiento diagonal hacia delante de los peones.
- Damas de largo alcance.
- Capturas opcionales: cualquier ficha propia puede realizar un movimiento legal aunque haya capturas disponibles.
- Sin leyes de cantidad ni calidad.
- Se puede terminar una captura múltiple tras cualquier salto tocando de nuevo la ficha movida; también se puede continuar por los destinos resaltados.
- Coronación, fin de partida y reglas de empate.
- Separar la lógica de reglas de la interfaz y crear pruebas automatizadas.

## Rival
- El humano lleva siempre blancas y empieza la partida; el iPad controla negras automáticamente.
- Dificultad fácil fija y cierta variación, utilizando los movimientos del motor existente.
- Mantener capturas opcionales para ambos, animaciones por salto y recuperación de turnos negros interrumpidos.
- No añadir selectores de modo ni dificultad.

## Accesibilidad
- Fichas grandes, alto contraste y grandes zonas táctiles.
- Selección por dos pulsaciones y teclado, con arrastre opcional mediante Pointer Events.
- Arrastre solo para fichas humanas y destinos legales; sueltas inválidas o canceladas no cambian el guardado.
- Sin anuncios, temporizadores, penalizaciones ni distracciones.
- Resaltar movimientos permitidos, incluidos los destinos lejanos inequívocos de capturas múltiples.
- Los atajos ejecutan saltos y traslados en orden; destinos con capturas diferentes requieren selección por etapas. Conservar parada voluntaria y guardar el resultado completo antes de animar.
- Dificultad baja para jugar contra la máquina.
- Botón grande «Nueva partida»: confirmación durante el juego y reinicio directo tras el resultado.
- Resultado después de la última animación; celebración suave solo para victoria humana, sin repetirse al restaurar. Respetar reducción de movimiento.
- Guardado automático y recuperación de partida, incluida la colección de capturas.
- Tras cada salto, trasladar la víctima original a la colección sin recortes ni duplicados; bloquear entrada hasta terminar ambas fases y respetar reducción de movimiento.
- Pantalla de juego limitada a tablero con colección de fichas capturadas debajo, indicador del turno y botón grande «Nueva partida»; al terminar, sustituir tablero por resultado y conservar un único botón. Sin ajustes, selectores de reglas, menús ocultos ni PIN.

## Desarrollo
1. Crear tablero y motor de reglas.
2. Incorporar juego local.
3. Añadir inteligencia artificial con varios niveles.
4. Implementar PWA y funcionamiento offline.
5. Probar en Safari y en el iPad de 2019.

## Criterios
- Mantener el código legible y modular.
- No utilizar reglas de damas inglesas por error.
- Priorizar facilidad de uso y estabilidad.
- No introducir cambios importantes en las reglas sin consultar.
