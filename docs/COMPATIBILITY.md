# Compatibilidad y APIs internas

GNOME Shell no tiene una API estable para extensiones. Todo lo que se importa de `resource:///org/gnome/shell/ui/` puede cambiar entre versiones. Este documento lista qué usa Bahía Dock y dónde, para saber qué revisar al portar a una versión nueva.

## Versión objetivo

| Componente | Versión comprobada |
|---|---|
| GNOME Shell | 50.0 |
| Mutter | 50.0 |
| GJS | 1.88.0 |
| Distribución | Fedora 44 |

## APIs usadas

| API | Archivo | Estabilidad | Comprobado en |
|---|---|---|---|
| `Extension` (`resource:///org/gnome/shell/extensions/extension.js`) | `extension.js` | Pública para extensiones | 50.0 |
| `Extension.getSettings()` | `extension.js` | Pública | 50.0 |
| `Extension.getLogger()` | `extension.js` | Pública (desde 48) | 50.0 |
| `ExtensionPreferences.fillPreferencesWindow()` (async) | `prefs.js` | Pública | 50.0 |
| `GLib.timeout_add`, `GLib.source_remove` | `core/lifecycle.js` | Estable (GLib) | 50.0 |

APIs internas previstas para el dock (Fase 1 y siguientes), a confirmar al implementarlas:

| API | Uso previsto | Referencia en Shell 50 |
|---|---|---|
| `Main.layoutManager.addChrome()` / `removeChrome()` | Espacio reservado | `ui/layout.js` |
| `Main.overview.dash` | Ocultar el dash nativo | `ui/overview.js` |
| `Main.notify()` | Aviso al ocultar el dash | `ui/main.js` |
| `AppFavorites` | Favoritas | `ui/appFavorites.js` |
| `AppMenu` | Menú contextual | `ui/appMenu.js` |
| `DND.makeDraggable()` | Arrastrar iconos | `ui/dnd.js` |

## Al portar a una versión nueva de GNOME Shell

1. Añadir la versión a `shell-version` en `metadata.json`.
2. Revisar los archivos de las tablas anteriores contra las fuentes de la nueva versión.
3. Pasar la lista de comprobación de [DEVELOPMENT.md](DEVELOPMENT.md).
4. Actualizar las tablas de este documento.
