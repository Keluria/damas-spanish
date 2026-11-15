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
- Damas españolas tradicionales.
- Movimiento diagonal hacia delante de los peones.
- Damas de largo alcance.
- Capturas obligatorias y encadenadas.
- Aplicar la ley de la cantidad y, en caso de empate, la ley de la calidad.
- Coronación, fin de partida y reglas de empate.
- Separar la lógica de reglas de la interfaz y crear pruebas automatizadas.

## Accesibilidad
- Fichas grandes, alto contraste y grandes zonas táctiles.
- Selección por dos pulsaciones, sin arrastrar.
- Sin anuncios, temporizadores, penalizaciones ni distracciones.
- Resaltar movimientos permitidos.
- Dificultad baja para jugar contra la máquina.
- Botones grandes y confirmación antes de reiniciar.
- Guardado automático y recuperación de partida.
- Ajustes sencillos para el cuidador.

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
