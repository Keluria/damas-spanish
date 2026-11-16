# Damas Españolas

Juego de damas españolas para iPad, diseñado especialmente para una persona mayor con Alzheimer.

## Objetivo
Crear una aplicación sencilla, accesible y fácil de utilizar, que permita jugar a las damas españolas contra el iPad, sin anuncios, distracciones ni necesidad de conexión permanente a Internet.

## Características
- Tablero tradicional de 8 × 8 casillas.
- Variante simplificada fija de las damas españolas: capturas opcionales y sin prioridades.
- Partidas contra el iPad: el humano lleva negras y empieza; el iPad lleva blancas.
- Fichas grandes y controles táctiles.
- Movimientos mediante dos pulsaciones o arrastrar y soltar.
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

Implementa juego **contra el iPad**, con dificultad fácil fija. El humano lleva negras y comienza; el iPad responde automáticamente con blancas. No hay selectores de modo ni de dificultad.

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

- `src/engine.ts`: motor puro, independiente del DOM, con movimientos completos, capturas opcionales, coronación, fin por bloqueo o falta de fichas y tablas por triple repetición de posición con el mismo turno. `MoveProvider` conserva un contrato para otras estrategias de rival.
- `src/ai.ts`: elección ponderada y ligera entre los movimientos legales, sin búsqueda profunda ni red.
- `src/opponent.ts`: coordinación de los turnos blancos, pausa breve, cancelación al reiniciar y recuperación de capturas interrumpidas.
- `src/interaction.ts`: selección por dos pulsaciones y capturas encadenadas opcionales, sin dependencia del DOM.
- `src/animation.ts`: presentación animada de cada desplazamiento y bloqueo temporal de entrada; usa la interacción existente sin cambiar el motor.
- `src/result.ts`: presentación única del resultado calculado por el motor, aplazada hasta finalizar la última animación.
- `src/main.ts`: tablero, indicador del turno y botón grande «Nueva partida» con confirmación durante la partida y reinicio directo después del resultado. Sin ajustes, selector de reglas, menús ocultos ni PIN. Solo se muestran avisos adicionales si no se puede guardar o recuperar la partida.
- `src/storage.ts`: guardado local versionado y validado. Conserva también la selección y el progreso de una captura múltiple; mantiene la compatibilidad con el formato anterior. Los datos inválidos se descartan con aviso y el almacenamiento bloqueado no impide jugar.
- `src/*.test.ts`: pruebas del motor y de la persistencia.
- `vite.config.ts`: configuración de Vite y PWA con Workbox.

### Reglas de esta versión

Se juega en casillas claras, con la casilla inferior derecha jugable. Negras empiezan. Los peones avanzan y capturan **solo hacia delante**; las damas recorren las cuatro diagonales y pueden aterrizar en cualquiera de las casillas libres tras la víctima. La captura es **opcional**: se puede mover cualquier ficha propia a un destino legal aunque haya capturas. No se aplican las leyes de cantidad ni calidad. Después de cada salto de una captura múltiple se puede continuar tocando otro destino marcado o terminar el turno **tocando de nuevo la ficha que acaba de saltar**. El indicador del turno explica ambas opciones. Si no quedan saltos posibles, el turno termina automáticamente. Durante una cadena no se puede cambiar de ficha ni añadir movimientos sin captura. Las piezas capturadas siguen bloqueando las diagonales hasta terminar el turno y no pueden capturarse otra vez. La coronación ocurre al finalizar el movimiento, sin continuar como dama recién coronada en ese turno.

### Rival del iPad

El humano utiliza siempre las negras y juega primero. Tras completar el turno humano, el iPad espera unos **650 ms** y mueve las blancas. El indicador identifica de quién es el turno. La pantalla conserva únicamente tablero, indicador y «Nueva partida»; el diseño de madera no cambia.

La dificultad es fácil: se da algo más de peso a capturas, coronaciones, avance y casillas centrales, y se elige con variación entre **todas** las opciones legales. No es una elección uniforme ni una búsqueda competitiva. Las capturas siguen siendo opcionales para ambos: el iPad también puede elegir no capturar o terminar una cadena antes del último salto.

La máquina utiliza exactamente la misma interacción y las mismas animaciones que el humano, salto a salto. Durante el turno blanco se ignoran las pulsaciones sobre el tablero. «Nueva partida» está disponible durante la pausa previa; al abrir su confirmación se suspende la respuesta pendiente. Solo queda desactivada durante un desplazamiento, como antes. Cancelar la confirmación reanuda la respuesta; confirmar borra la partida y deja siempre el primer turno al humano.

Se mantiene la compatibilidad del guardado mediante migración a v2. Al abrir una partida con turno blanco, el rival responde una sola vez; si se había interrumpido una cadena blanca, retoma la casilla y los saltos pendientes sin repetir las capturas ya guardadas. El resto de la secuencia puede variar al recuperarla. Una recarga durante una animación recupera el salto que ya se guardó, no el origen anterior. Si la aplicación se oculta, se suspende la coordinación y se reanuda al volver.

Las pruebas automatizadas cubren legalidad y variación, respuesta única, bloqueo de pulsaciones, reinicio, confirmación suspendida, restauración, capturas opcionales cortas y completas y animación secuencial. También se han comprobado ocho recorridos con Playwright en Chromium real sobre la compilación de producción: respuesta animada única, reinicio durante la pausa, recargas antes y durante el movimiento, captura doble, continuación guardada, coronación y reducción de movimiento. La comprobación en Safari/iPadOS 18 y el iPad físico de 2019 sigue pendiente.

### Animaciones de movimiento

Los movimientos normales duran aproximadamente **350 ms**. La duración aumenta 70 ms por casilla diagonal adicional, hasta **770 ms**, para facilitar el seguimiento de las damas de largo alcance. En una captura, la ficha realiza una elevación discreta sobre la rival; después del aterrizaje, la rival viaja hasta la colección situada debajo del tablero. Cada salto de una cadena se anima por separado y después se puede continuar o terminar tocando la ficha, como antes.

Se anima la ficha existente con Web Animations y `transform`, sin copias ni cambios de colores. Durante el desplazamiento se conservan los resaltados, se ignoran las pulsaciones del tablero y se desactiva brevemente «Nueva partida». El indicador del turno se actualiza al finalizar. El movimiento elegido se guarda antes de empezar la animación para no perderlo si se recarga o cierra la página.

La preferencia del sistema **Reducir movimiento** (`prefers-reduced-motion`) hace que los movimientos sean instantáneos. Si cambia durante una animación, se gira la pantalla o se oculta la página, se presenta la posición final sin bloquear el juego. También se usa movimiento instantáneo si Web Animations no está disponible. No se añaden ajustes ni botones.

Las pruebas automatizadas comprueban equivalencia con la interacción sin animación, guardado durante un salto, bloqueo de pulsaciones, capturas secuenciales y parada voluntaria, reducción de movimiento y recuperación tras interrupciones. Queda pendiente verificar visualmente la fluidez en Safari/iPadOS 18 y en el iPad físico de 2019.

### Final de partida

Al terminar, el resultado sustituye al tablero dentro del mismo panel de madera. Se consulta `outcome()` del motor: victoria por falta de fichas o movimientos, y tablas según la triple repetición ya implementada. No cambian las reglas ni la dificultad del rival.

- Si ganan las negras: «¡Has ganado!» y «¡Muy bien jugado!», con aparición gradual y cinco estrellas doradas discretas durante unos dos segundos, sin repeticiones, sonidos ni destellos.
- Si ganan las blancas: «Partida terminada» y un mensaje amable, sin celebración.
- Si hay empate: «¡Tablas! Buena partida», sin celebración.

Los tres resultados conservan **un único botón grande «Nueva partida»**, que reinicia directamente y devuelve el primer turno al humano. Durante una partida en curso el botón sigue pidiendo confirmación.

La presentación espera a que termine la última animación de ficha y su limpieza. El foco pasa al título del resultado, asociado a su mensaje para lectores de pantalla; los elementos decorativos no se anuncian. Con `prefers-reduced-motion` el mensaje y las estrellas son estáticos. Al reabrir una partida ya terminada se muestra el resultado sin repetir la celebración y con guardado compatible mediante migración a la versión 2.

Las pruebas cubren victoria, derrota, tablas, presentación tras el último salto, reinicio, restauración y ausencia de celebraciones duplicadas. También se ha comprobado en Chromium real con Playwright el resultado de una captura ganadora, victoria del rival, triple repetición, botón único, reinicio directo, confirmación durante la partida y reducción de movimiento. Pendiente verificación en Safari/iPadOS 18 y VoiceOver del iPad físico.

### Instalación y uso sin conexión

En Safari del iPad, cargar una vez con conexión y dejar que termine la carga inicial. Después, Compartir → Añadir a pantalla de inicio. La interfaz no muestra menús de ayuda ni controles de instalación. El service worker solo funciona en HTTPS o localhost y se genera en compilación, no durante `npm run dev`. Para comprobarlo localmente, usar `npm run build` y `npm run preview`, cargar la aplicación y volver a abrirla sin red.

Las nuevas versiones del service worker esperan a que se cierren las ventanas de la versión anterior; no se recarga una partida de forma automática. Safari puede eliminar el almacenamiento y la caché por políticas del sistema. No hay sincronización, exportación ni copia en la nube. El guardado es propio de cada origen y navegador.

### Limitaciones y validación pendiente

- Hay una única dificultad fácil y no hay rotación del tablero: el humano lleva negras abajo. La IA no busca varias jugadas por adelantado, no adapta su dificultad y no garantiza siempre la mejor decisión.
- La triple repetición se resuelve automáticamente. **No se implementan aún los otros supuestos reglamentarios de tablas**, incluidos los límites de movimientos sin capturas/avance de peón y los finales de material específicos. Por tanto, esta versión no es todavía un motor reglamentario completo para competición.
- No hay ajustes para el cuidador, selectores de reglas ni menús. Se conservan fichas grandes, contraste alto, etiquetas accesibles y foco de teclado. No hay sonidos ni reloj. Las marcas indican selección y destinos sin depender solo del color.
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

## Vista temporal de prueba de victoria (solo desarrollo)

Para comprobar la celebración sin jugar una partida completa, usar la rama de esta PR y ejecutar:

```sh
npm ci
npm run dev:victory
```

Abrir **http://localhost:5175/damas-spanish/** en el navegador de la máquina que ejecuta el servidor. El título de la pestaña será «Prueba de victoria · Desarrollo». Para abrirla desde un iPad en la misma red, usar la dirección de red que muestra Vite con el puerto 5175. No es una dirección pública ni un despliegue en GitHub Pages.

1. Tocar la única ficha negra, en **e4** (quinta columna y quinta fila desde arriba).
2. Tocar **c6** (tercera columna y tercera fila desde arriba), dos casillas en diagonal hacia arriba a la izquierda. Se captura la única blanca de d5.
3. Al terminar el salto y el traslado de la ficha capturada, aparece «¡Has ganado!», «¡Muy bien jugado!» y la celebración real de cinco estrellas durante unos dos segundos.
4. Pulsar el único botón **Nueva partida**: reinicia directamente con 12 fichas por color y negras al turno.
5. **Recargar la página** para volver al escenario de dos fichas y repetir la celebración. Si el sistema tiene Reducir movimiento activado, se muestra el resultado sin animaciones, como en el juego normal.

El servidor específico utiliza `vite.victory.config.ts`: conserva el HTML, motor, interacción, animación, IA y pantalla de resultado reales. Solo sustituye el adaptador de guardado por otro en memoria, inicializado con la posición de prueba. No lee ni escribe `localStorage`, no modifica partidas existentes y no añade controles al juego normal. Usa un puerto separado y falla si ya está ocupado.

`npm run dev`, `npm run build`, `npm run preview` y el despliegue continúan usando la configuración normal. La configuración especial rechaza explícitamente `vite build` y `vite preview`. El escenario no se importa en producción y no hay parámetros URL que lo activen.

### Comprobación automatizada y vídeo

`npm test` incluye pruebas de legalidad, captura ganadora, resultado después del salto, reinicio e independencia del guardado. El workflow **Verify development victory preview** prueba además la vista en Chromium real con Playwright y guarda el artefacto **victory-preview**, con las capturas y **victory.webm**. Se puede descargar desde la ejecución de Actions de esta PR para ver la celebración sin ejecutar un servidor. Este workflow solo comprueba; no publica.

Para repetir esa comprobación de navegador localmente (las herramientas se instalan solo en `node_modules`, sin modificar el manifiesto ni el lockfile):

```sh
npm install --no-save --package-lock=false playwright@1.65.1
npx playwright install chromium
npm run test:victory:browser
```

La prueba verifica la captura y las estrellas reales, el botón único y el reinicio directo, que la partida existente permanezca intacta, que la recarga reponga el escenario, que la compilación especial esté bloqueada y que parámetros URL no activen la prueba en el artefacto de producción.


## Arrastrar y soltar

Se puede mover con dos pulsaciones, con teclado (Enter/Espacio sobre las casillas) o arrastrando con el dedo o el ratón. Un desplazamiento inferior a **8 píxeles CSS** conserva el comportamiento de pulsación. Al arrastrar, la ficha original sigue al puntero y los destinos legales permanecen resaltados; no se crea una copia visible.

Solo una suelta sobre un destino legal confirma la jugada mediante la interacción y el motor existentes. La suelta válida se guarda una sola vez como movimiento y no reproduce otra vez la animación de desplazamiento. Una casilla ilegal, ocupada o una suelta fuera del tablero devuelve la ficha suavemente en unos 180 ms y conserva tanto la partida como su selección anterior. Con Reducir movimiento el retorno es instantáneo.

Las capturas siguen siendo opcionales. En una cadena se puede arrastrar la ficha desde su casilla actual hacia otro salto legal o terminar tocándola, como antes. No se arrastra durante el turno del iPad ni durante una animación. Nueva partida se desactiva brevemente durante el arrastre y el retorno, evitando reinicios a mitad del gesto.

La captura del puntero se realiza sobre el tablero para conservarla aunque se reconstruyan sus casillas. Solo las casillas de fichas humanas que pueden moverse desactivan el desplazamiento táctil; el resto de la página conserva su navegación habitual. Pointercancel, pérdida de captura, Escape, pérdida de foco, ocultación de la página y cambios de tamaño/orientación cancelan el gesto sin cambiar el guardado. La ficha flotante solo usa transform y se actualiza como máximo una vez por fotograma.

### Comprobación de arrastre

Además de `npm test`, `npm run build` y `node scripts/check-pages.mjs`, la integración con Playwright se ejecuta sobre el artefacto real de producción:

```sh
npm install --no-save --package-lock=false playwright@1.65.1
npx playwright install chromium
npm run test:drag:browser
```

El workflow **Verify drag input** ejecuta esa comprobación en Chromium y conserva capturas y resultados como artefacto **drag-checks**. Cubre arrastre válido, inválido y fuera del tablero, seguimiento del puntero, captura, dama de largo alcance, cadena opcional, ausencia de jugadas duplicadas, dos pulsaciones, teclado, turno del iPad, cancelaciones y reducción de movimiento. Usa eventos táctiles nativos de Chromium para comprobar el arrastre con el dedo y que la página sigue desplazándose fuera del tablero.

Esta emulación táctil no sustituye la comprobación física de Safari/iPadOS 18 y VoiceOver en el iPad de 2019, que sigue pendiente. La estética de madera, la celebración y las reglas se conservan. El guardado antiguo se migra a la versión 2.


## Traslado de fichas capturadas

Después de cada salto, la ficha rival original se mueve durante unos **650 ms** desde su casilla hasta su hueco bajo el tablero. Una capa temporal fija permite cruzar el marco sin recortes. Se reduce suavemente al tamaño de la colección al llegar; no se utilizan copias visibles. Las capturas múltiples alternan salto y traslado, uno por uno, también para el iPad. Tras un arrastre válido no se repite el movimiento del atacante.

El tablero y Nueva partida permanecen bloqueados durante ambas fases. El resultado y el cambio visual de turno esperan a que terminen. Reducir movimiento presenta directamente la posición final. Ocultación, pérdida de foco, desplazamiento de página y cambios de tamaño interrumpen el traslado y presentan el estado guardado.

Se guarda el salto y la colección **antes** de animar. Una recarga restaura ambos sin repetir vuelos. El guardado mantiene la clave anterior e incorpora un campo opcional de capturas ordenadas, incluida su condición de dama. La versión 2 identifica los nuevos colores de jugadores. Las partidas antiguas siguen siendo válidas. Si no contienen historial de capturas, su colección comienza vacía y registra las siguientes; si lo contienen, se conserva al migrar. Nueva partida vacía la colección. No cambia el motor de reglas.

Para verificar las posiciones intermedias reales y generar capturas y vídeo:

```sh
npm install --no-save --package-lock=false playwright@1.65.1 pngjs@7.0.0
npx playwright install chromium ffmpeg
npm run test:captures:browser
```

La prueba usa la compilación de producción y partidas aisladas en contextos de navegador, sin tocar el guardado del usuario. Comprueba orden salto/traslado, identidad de la ficha, posiciones intermedias, píxeles visibles fuera del marco, destino y tamaño finales, captura múltiple, arrastre sin animación repetida, victoria aplazada, reinicio, recarga y reducción de movimiento. El workflow **Verify drag input** ejecuta también esta prueba y conserva el artefacto **captured-pieces** con vídeo, imágenes y resultados. Verificación física en Safari/iPadOS 18 y el iPad de 2019 pendiente.


## Destino directo de capturas múltiples

Al seleccionar una ficha se resaltan todos los destinos legales, tanto intermedios como finales, incluidos los que requieren elegir una ruta. Tocar un destino lejano ejecuta automáticamente los saltos legales hasta esa casilla. Cada salto va seguido del traslado de su víctima a la colección antes de comenzar el siguiente. Las rutas provienen del motor y no se aplican prioridades de cantidad/calidad.

También se puede arrastrar directamente al destino lejano. Al soltar, la ficha vuelve suavemente al origen del gesto y después recorre los saltos reales; así no se sustituye la ruta por un desplazamiento recto. El bloqueo de tablero y Nueva partida se mantiene durante el retorno y toda la secuencia. Un movimiento de un solo salto conserva el arrastre habitual, sin repetirlo. Reducir movimiento presenta los estados instantáneamente.

Los destinos inmediatos conservan la selección por etapas: tras un salto se puede continuar o terminar tocando de nuevo la ficha. Un atajo de varios saltos termina en la casilla elegida, aunque existan más capturas después. No hay obligación de continuar ni de capturar.

Si varias rutas al mismo destino capturan exactamente las mismas fichas, se escoge la ruta de casillas en orden numérico lexicográfico (índices fila × 8 + columna). Si capturan fichas diferentes, se abre un diálogo temporal «Elige cómo llegar a…»: cada botón indica cuántas fichas captura, el recorrido y las casillas capturadas. Se elige con pulsación o teclado (Tab y Enter/Espacio); Cancelar o Escape conservan la selección y la partida. El destino permanece resaltado y se admite tanto por pulsación como por arrastre. No hay botones de rutas permanentes.

Cuando una casilla es destino inmediato y también final de una cadena, el diálogo ofrece ambas opciones; ninguna tiene prioridad automática. Si un recorrido vuelve a la casilla actual, también se conserva la opción de deseleccionar o terminar aquí. Elegir un salto inmediato mantiene la continuación opcional por etapas; elegir una ruta de varios saltos termina en el destino solicitado. La IA pasa explícitamente su etapa elegida y nunca abre el diálogo.

El resultado completo elegido se guarda antes del primer salto. Las posiciones intermedias solo se presentan en pantalla: no sobrescriben ese guardado. Cerrar o recargar durante la secuencia recupera la posición final y todas sus capturas sin reproducir la celebración. La estrategia de la IA se conserva: sigue eligiendo y ejecutando sus movimientos por etapas.

Comprobación con Chromium real:

```sh
npm install --no-save --package-lock=false playwright@1.65.1 pngjs@7.0.0
npx playwright install chromium ffmpeg
npm run test:destinations:browser
```

Cubre capturas dobles y triples, posiciones intermedias visibles de cada salto y traslado, pulsaciones, arrastre con ratón y táctil nativo, coronación, parada voluntaria, rutas equivalentes y ambiguas, bloqueo continuo, guardado, restauración y reducción de movimiento. El workflow **Verify drag input** conserva el artefacto **multi-capture-destinations**, con vídeo `triple.webm`, capturas y muestras de posiciones. Las pruebas se ejecutan en contextos aislados sobre la compilación de producción; no hay parámetros ni botones de prueba en el juego público. Safari/iPadOS 18 y el iPad físico de 2019 siguen pendientes de comprobación.


## Colores de jugadores, migración y nogal oscuro

El humano juega siempre con **negras**, abajo, y empieza. Las blancas del iPad se colocan arriba. Los peones negros avanzan hacia arriba y coronan en la fila superior; los blancos avanzan hacia abajo y coronan en la inferior. Las damas siguen moviéndose en ambas direcciones. Solo una victoria negra activa «¡Has ganado!» y las estrellas.

El guardado **v2** mantiene la clave local anterior. Al leer un guardado v1 válido se intercambian colores de fichas, turno, colección e historial de repetición, sin cambiar casillas, coronaciones, selección ni progreso de captura: el antiguo humano blanco pasa a ser el humano negro y la antigua máquina negra pasa a blanca. El guardado se valida después de convertir y se escribe como v2, evitando nuevas inversiones en recargas posteriores. También se migran partidas terminadas y turnos de máquina pendientes. Los datos corruptos continúan descartándose con aviso; no se mezclan ni se asignan fichas del rival antiguo al humano nuevo.

La madera exterior de toda la página es nogal oscuro, incluidos márgenes y espacio bajo el botón. El panel de juego y la colección son opacos y claros para mantener contraste, con borde más claro y foco dorado en Nueva partida. No cambian casillas, fichas ni animaciones.

Las pruebas de navegador incluyen captura doble directa inequívoca, triple con ratón y táctil, rutas ambiguas elegibles, destino compartido inmediato/final con ambas opciones, cancelación y elección por teclado, respuesta de la IA blanca, reinicio/restauración con negras y captura de pantalla completa que comprueba píxeles oscuros alrededor y debajo. Se conserva la limitación de tablas: solo triple repetición, no el reglamento completo de competición. No se han podido probar Safari/iPadOS 18, VoiceOver ni el iPad físico de 2019 en este entorno; Chromium real y sus eventos táctiles no sustituyen esa comprobación.
