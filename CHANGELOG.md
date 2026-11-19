# Cambios

## 0.5.0 — Fase 4: estética y visibilidad

- Modo claro y oscuro: la píldora sigue el esquema de color del sistema, igual que GNOME Shell.
- Magnificación: el icono bajo el puntero crece desde su centro y sus vecinos crecen menos cuanto más lejos están. La píldora es lo bastante ancha para que el icono quepa a tamaño máximo, así que magnificar no cambia el espacio reservado. Se activa o desactiva con la clave `dock-magnification` y el tamaño máximo se ajusta con `dock-magnification-scale` (por defecto 1,3; la píldora pasa de 74 a unos 88 px). Desactivada, la píldora recupera su ancho anterior.
- Visibilidad (clave `dock-visibility`):
  - **Siempre visible** (por defecto): como hasta ahora, reservando su espacio.
  - **Ocultar automáticamente**: no reserva espacio; se esconde y aparece encima de las ventanas al llevar el puntero al borde izquierdo.
  - **Ocultar si una ventana lo tapa** (intellihide): no reserva espacio y se esconde solo cuando una ventana del escritorio actual ocupa su sitio.
  - En los dos modos con ocultado, el dock sigue a la vista con el puntero encima, con un menú abierto, durante un arrastre y en la vista general.
- Preferencias: visibilidad, magnificación y su tamaño.
- Prueba automática ampliada: modo claro, magnificación sin cambios en el espacio reservado y los tres modos de visibilidad.

## 0.4.0 — Fase 3: interacción

- Menú contextual con clic derecho, pulsación larga o tecla Menú: el mismo de GNOME (ventanas abiertas, nueva ventana, acciones de la app, fijar o quitar de favoritos, detalles y salir), abierto a la derecha del dock.
- Etiqueta con el nombre de la app al pasar el puntero, también en el botón de la cuadrícula. Aparece tras un instante y cambia al momento al pasar a otro icono.
- Arrastrar iconos para reordenar las favoritas. Una app abierta, o un icono de la cuadrícula de aplicaciones, se fija como favorita al soltarlo entre ellas. Un hueco marca dónde caerá.
- Clic en la app con el foco: minimiza sus ventanas del escritorio actual. Otro clic las restaura. Se puede desactivar en las preferencias (clave `dock-minimize-on-click`).
- Prueba automática ampliada: etiqueta, menú, reordenar, fijar arrastrando, minimizar y restaurar.

### Ajustes

- La píldora del dock queda más cerca del borde izquierdo (4 px) y de las ventanas maximizadas (2 px). El espacio reservado pasa de 88 a 80 px a 1x.

## 0.3.0 — Fase 2: apps abiertas

- Indicadores de ventanas: un punto por ventana abierta (hasta tres) a la izquierda de cada icono, sin cambiar el ancho del dock.
- La app con el foco se resalta con un fondo suave y puntos más brillantes.
- Las apps abiertas que no son favoritas aparecen en su propia sección, en el orden en que se abrieron, y desaparecen al cerrarlas.
- Un icono pasa de una sección a otra sin recrearse al añadir o quitar la app de favoritas.
- Prueba automática ampliada: abre una app, comprueba su indicador y su foco, la quita de favoritas (solo en el entorno aislado) y la cierra.

## 0.2.0 — Fase 1: dock estático

- Dock flotante a la izquierda, centrado en vertical, con las aplicaciones favoritas de GNOME.
- Clic para abrir o enfocar una aplicación; Ctrl+clic o clic central abre una ventana nueva.
- Botón para mostrar la cuadrícula de aplicaciones.
- Espacio reservado: las ventanas maximizadas empiezan a la derecha del dock.
- Se oculta en pantalla completa.
- Los iconos se reducen si no caben en la altura de la pantalla.
- El dash nativo de la vista general se oculta mientras el dock está activo, con un aviso la primera vez, y se restaura al desactivar.
- Prueba automática ampliada: mide el espacio reservado, maximiza una ventana, simula un clic y guarda capturas.

## 0.1.0 — Fase 0: base del proyecto

- Nuevo nombre: Bahía Dock, UUID `bahia-dock@bahia-dock.github.io`.
- Estructura modular: `core/` (contrato de módulos, gestor, ciclo de vida y registro) y `features/dock/` (esqueleto).
- Esquema de GSettings `org.gnome.shell.extensions.bahia-dock` con `dock-enabled` y `debug-logging`.
- Ventana de preferencias básica.
- Scripts de desarrollo: instalación con enlace simbólico, sesión anidada y empaquetado.
- Documentación de arquitectura, desarrollo y compatibilidad.
