# Damas Españolas

Juego de damas españolas para iPad, diseñado especialmente para una persona mayor con Alzheimer.

## Objetivo
Crear una aplicación sencilla, accesible y fácil de utilizar, que permita jugar a las damas españolas contra el iPad, sin anuncios, distracciones ni necesidad de conexión permanente a Internet.

## Características
- Tablero tradicional de 8 × 8 casillas.
- Variante simplificada fija de las damas españolas: capturas opcionales y sin prioridades.
- Partidas locales para dos personas; rival automático pendiente.
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

Abrir la ruta `/damas-spanish/` del servidor. `npm run build` comprueba TypeScript y genera `dist/`, el manifest y un service worker con precaché de los recursos. La base de Vite, el ámbito de la PWA y su inicio están configurados para **`/damas-spanish/`**. El workflow `.github/workflows/deploy.yml` comprueba las pull requests y despliega únicamente el contenido de `dist/` en GitHub Pages cuando se actualiza `main`, mediante HTTPS.

### Arquitectura

- `src/engine.ts`: motor puro, independiente del DOM, con movimientos completos, capturas opcionales, coronación, fin por bloqueo o falta de fichas y tablas por triple repetición de posición con el mismo turno. `MoveProvider` define el punto de entrada de una futura IA.
- `src/interaction.ts`: selección por dos pulsaciones y capturas encadenadas opcionales, sin dependencia del DOM.
- `src/animation.ts`: presentación animada de cada desplazamiento y bloqueo temporal de entrada; usa la interacción existente sin cambiar el motor.
- `src/main.ts`: tablero, indicador del turno y botón grande «Nueva partida» con confirmación. Sin ajustes, selector de reglas, menús ocultos ni PIN. Solo se muestran avisos adicionales si no se puede guardar o recuperar la partida.
- `src/storage.ts`: guardado local versionado y validado. Conserva también la selección y el progreso de una captura múltiple; mantiene la compatibilidad con el formato anterior. Los datos inválidos se descartan con aviso y el almacenamiento bloqueado no impide jugar.
- `src/*.test.ts`: pruebas del motor y de la persistencia.
- `vite.config.ts`: configuración de Vite y PWA con Workbox.

### Reglas de esta versión

Se juega en casillas claras, con la casilla inferior derecha jugable. Blancas empiezan. Los peones avanzan y capturan **solo hacia delante**; las damas recorren las cuatro diagonales y pueden aterrizar en cualquiera de las casillas libres tras la víctima. La captura es **opcional**: se puede mover cualquier ficha propia a un destino legal aunque haya capturas. No se aplican las leyes de cantidad ni calidad. Después de cada salto de una captura múltiple se puede continuar tocando otro destino marcado o terminar el turno **tocando de nuevo la ficha que acaba de saltar**. El indicador del turno explica ambas opciones. Si no quedan saltos posibles, el turno termina automáticamente. Durante una cadena no se puede cambiar de ficha ni añadir movimientos sin captura. Las piezas capturadas siguen bloqueando las diagonales hasta terminar el turno y no pueden capturarse otra vez. La coronación ocurre al finalizar el movimiento, sin continuar como dama recién coronada en ese turno.

### Animaciones de movimiento

Los movimientos normales duran aproximadamente **350 ms**. La duración aumenta 70 ms por casilla diagonal adicional, hasta **770 ms**, para facilitar el seguimiento de las damas de largo alcance. En una captura, la ficha realiza una elevación discreta sobre la rival; la rival desaparece al aterrizar. Cada salto de una cadena se anima por separado y después se puede continuar o terminar tocando la ficha, como antes.

Se anima la ficha existente con Web Animations y `transform`, sin copias ni cambios de colores. Durante el desplazamiento se conservan los resaltados, se ignoran las pulsaciones del tablero y se desactiva brevemente «Nueva partida». El indicador del turno se actualiza al finalizar. El movimiento elegido se guarda antes de empezar la animación para no perderlo si se recarga o cierra la página.

La preferencia del sistema **Reducir movimiento** (`prefers-reduced-motion`) hace que los movimientos sean instantáneos. Si cambia durante una animación, se gira la pantalla o se oculta la página, se presenta la posición final sin bloquear el juego. También se usa movimiento instantáneo si Web Animations no está disponible. No se añaden ajustes ni botones.

Las pruebas automatizadas comprueban equivalencia con la interacción sin animación, guardado durante un salto, bloqueo de pulsaciones, capturas secuenciales y parada voluntaria, reducción de movimiento y recuperación tras interrupciones. Queda pendiente verificar visualmente la fluidez en Safari/iPadOS 18 y en el iPad físico de 2019.

### Instalación y uso sin conexión

En Safari del iPad, cargar una vez con conexión y dejar que termine la carga inicial. Después, Compartir → Añadir a pantalla de inicio. La interfaz no muestra menús de ayuda ni controles de instalación. El service worker solo funciona en HTTPS o localhost y se genera en compilación, no durante `npm run dev`. Para comprobarlo localmente, usar `npm run build` y `npm run preview`, cargar la aplicación y volver a abrirla sin red.

Las nuevas versiones del service worker esperan a que se cierren las ventanas de la versión anterior; no se recarga una partida de forma automática. Safari puede eliminar el almacenamiento y la caché por políticas del sistema. No hay sincronización, exportación ni copia en la nube. El guardado es propio de cada origen y navegador.

### Limitaciones y validación pendiente

- No hay rival automático, elección de dificultad ni rotación del tablero: ambos jugadores comparten el iPad y las blancas están abajo.
- La triple repetición se resuelve automáticamente. **No se implementan aún los otros supuestos reglamentarios de tablas**, incluidos los límites de movimientos sin capturas/avance de peón y los finales de material específicos. Por tanto, esta versión no es todavía un motor reglamentario completo para competición.
- No hay ajustes para el cuidador, selectores de reglas ni menús. Se conservan fichas grandes, contraste alto, etiquetas accesibles y foco de teclado. No hay sonidos, reloj ni arrastre. Las marcas indican selección y destinos sin depender solo del color.
- El tablero se adapta al ancho; está optimizado para iPad. En teléfonos pequeños las casillas pueden medir menos de 44 px.
- Compatibilidad prevista con Safari/iPadOS 18; falta validar en el iPad físico de 2019 y con VoiceOver. Las pruebas en Chromium no sustituyen esa comprobación.
- El historial de repetición se conserva hasta un movimiento irreversible; no hay deshacer ni historial visible de jugadas.
- La publicación se realiza al actualizar `main`; la verificación final en Safari debe hacerse sobre la URL publicada.


## Despliegue en GitHub Pages

En **Settings → Pages → Build and deployment**, seleccionar **Source: GitHub Actions** (ya configurado para este repositorio). No se necesita una rama `gh-pages`, un backend, secretos propios ni servicios de pago.

El workflow **Deploy PWA to GitHub Pages** utiliza Node.js 24 y ejecuta, en este orden:

1. `npm ci` para instalar las versiones de `package-lock.json`.
2. `npm test`.
3. `npm run build` (incluye la comprobación de TypeScript).
4. `node scripts/check-pages.mjs` para comprobar las rutas del HTML compilado, manifest, iconos, registro y ámbito del service worker, fallback de navegación y todas las entradas del precaché bajo `/damas-spanish/`.
5. Solo en `main`, sube **exclusivamente `dist/`** como artefacto de Pages y lo despliega en el entorno `github-pages`.

Las pull requests ejecutan las comprobaciones sin publicar. El trabajo de compilación tiene permiso `contents: read`; el de despliegue recibe `pages: write` e `id-token: write`. La concurrencia evita despliegues simultáneos y no interrumpe uno ya iniciado. También puede ejecutarse manualmente desde **Actions → Deploy PWA to GitHub Pages → Run workflow**, seleccionando `main`; otra rama solo se comprueba y no publica.

### Cómo comprobar la publicación

1. Revisar y fusionar la pull request de despliegue en `main` cuando se quiera publicar. Abrir la PR no publica nada.
2. En **Actions**, abrir la ejecución **Deploy PWA to GitHub Pages** correspondiente a ese commit de `main`.
3. Comprobar que **Test and build** y **Deploy to GitHub Pages** terminan en verde. Si el entorno `github-pages` exige aprobación, autorizar ese despliegue desde GitHub.
4. Abrir el enlace del entorno mostrado en el trabajo de despliegue. La dirección prevista es **https://keluria.github.io/damas-spanish/**.
5. En Safari del iPad Pro, comprobar tablero, indicador del turno y botón «Nueva partida». Dejar que termine la primera carga con conexión y usar Compartir → Añadir a pantalla de inicio.
6. Mover una ficha, cerrar y volver a abrir para comprobar el guardado. Activar modo avión, cerrar y volver a abrir desde el icono instalado para comprobar el funcionamiento offline. Desactivar modo avión después de la prueba.

El comprobador del artefacto detecta rutas y archivos incorrectos antes de publicar; no sustituye la prueba real de instalación, caché y funcionamiento offline en Safari. La caché y el guardado del sitio publicado son independientes de los del servidor local. Para recibir futuras actualizaciones, recuperar la conexión y cerrar todas las ventanas de la versión anterior antes de volver a abrir la aplicación.
