# Damas Españolas

Juego de damas españolas para iPad, diseñado especialmente para una persona mayor con Alzheimer.

## Objetivo
Crear una aplicación sencilla, accesible y fácil de utilizar, que permita jugar a las damas españolas contra el iPad, sin anuncios, distracciones ni necesidad de conexión permanente a Internet.

## Características
- Tablero tradicional de 8 × 8 casillas.
- Reglas oficiales de las damas españolas.
- Partidas contra el ordenador.
- Diferentes niveles de dificultad.
- Fichas grandes y controles táctiles.
- Movimientos mediante dos pulsaciones.
- Indicaciones visuales de los movimientos permitidos.
- Guardado automático de partidas.
- Funcionamiento sin conexión mediante PWA.
- Interfaz adaptada para personas mayores.

## Compatibilidad
- iPad Pro para el desarrollo y las pruebas.
- iPad de 7.ª generación (2019) como dispositivo principal, pendiente de confirmar el modelo exacto.
- Safari compatible con iPadOS 18.
- Instalación desde Safari mediante «Añadir a pantalla de inicio».

## Tecnologías
- HTML5
- CSS3
- TypeScript
- Progressive Web App (PWA)
- Service Worker
- GitHub Pages

## Fases del proyecto
1. Implementación del tablero y movimientos.
2. Motor completo de reglas españolas.
3. Modo de juego local.
4. Inteligencia artificial con niveles de dificultad.
5. Accesibilidad y ajustes para el cuidador.
6. Instalación como PWA y pruebas sin conexión.

## Estado
Proyecto en fase inicial de desarrollo.

## Distribución
Uso personal y familiar. No se publicará en la App Store.

Desarrollado con ayuda de OpenAI Codex.

## Primera versión funcional (0.1)

Implementa juego **local para dos personas**. No hay IA ni niveles de dificultad todavía.

### Desarrollo y comprobación

Requiere Node.js 22.12 o posterior (probado con Node.js 24).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Abrir la ruta `/damas-spanish/` del servidor. `npm run build` comprueba TypeScript y genera `dist/`, el manifest y un service worker con precaché de los recursos. La base de Vite, el ámbito de la PWA y su inicio están configurados para **`/damas-spanish/`**. No se incluye ningún flujo que publique automáticamente: un futuro despliegue de GitHub Pages debe servir el contenido de `dist/` bajo esa ruta, mediante HTTPS.

### Arquitectura

- `src/engine.ts`: motor puro, independiente del DOM, con movimientos completos, prioridades, coronación, fin por bloqueo o falta de fichas y tablas por triple repetición de posición con el mismo turno. `MoveProvider` define el punto de entrada de una futura IA.
- `src/main.ts`: interacción por dos pulsaciones, guía paso a paso en capturas encadenadas, ayuda, contraste reforzado y confirmación antes de reiniciar.
- `src/storage.ts`: guardado local versionado y validado. Conserva también la selección y el progreso de una captura múltiple; los datos inválidos se descartan con aviso y el almacenamiento bloqueado no impide jugar.
- `src/*.test.ts`: pruebas del motor y de la persistencia.
- `vite.config.ts`: configuración de Vite y PWA con Workbox.

### Reglas de esta versión

Se juega en casillas claras, con la casilla inferior derecha jugable. Blancas empiezan. Los peones avanzan y capturan **solo hacia delante**; las damas recorren las cuatro diagonales y pueden aterrizar en cualquiera de las casillas libres tras la víctima. Es obligatorio completar la secuencia que capture más fichas y, a igualdad de cantidad, más damas. Se conservan todas las alternativas empatadas. Las piezas capturadas siguen bloqueando las diagonales hasta terminar el turno y no pueden capturarse otra vez. La coronación ocurre al finalizar el movimiento, sin continuar como dama recién coronada en ese turno.

### Instalación y uso sin conexión

En Safari del iPad, cargar una vez con conexión y esperar el mensaje «Juego preparado para abrirse sin conexión» en Ayuda. Después, Compartir → Añadir a pantalla de inicio. El service worker solo funciona en HTTPS o localhost y se genera en compilación, no durante `npm run dev`. Para comprobarlo localmente, usar `npm run build` y `npm run preview`, cargar la aplicación y volver a abrirla sin red.

Las nuevas versiones del service worker esperan a que se cierren las ventanas de la versión anterior; no se recarga una partida de forma automática. Safari puede eliminar el almacenamiento y la caché por políticas del sistema. No hay sincronización, exportación ni copia en la nube. El guardado es propio de cada origen y navegador.

### Limitaciones y validación pendiente

- No hay rival automático, elección de dificultad ni rotación del tablero: ambos jugadores comparten el iPad y las blancas están abajo.
- La triple repetición se resuelve automáticamente. **No se implementan aún los otros supuestos reglamentarios de tablas**, incluidos los límites de movimientos sin capturas/avance de peón y los finales de material específicos. Por tanto, esta versión no es todavía un motor reglamentario completo para competición.
- Contraste reforzado es el único ajuste para el cuidador. No hay sonidos, reloj ni arrastre. Las marcas indican selección y destinos sin depender solo del color.
- El tablero se adapta al ancho; está optimizado para iPad. En teléfonos pequeños las casillas pueden medir menos de 44 px.
- Compatibilidad prevista con Safari/iPadOS 18; falta validar en el iPad físico de 2019 y con VoiceOver. Las pruebas en Chromium no sustituyen esa comprobación.
- El historial de repetición se conserva hasta un movimiento irreversible; no hay deshacer ni historial visible de jugadas.
- No se ha desplegado públicamente el juego.
