# Cambios

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
