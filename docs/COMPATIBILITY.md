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

APIs internas de GNOME Shell usadas por el dock:

| API | Archivo | Riesgo al portar | Comprobado en |
|---|---|---|---|
| `Main.layoutManager.addChrome(actor, {affectsStruts, trackFullscreen})` / `removeChrome()` | `dockLayout.js` | Medio: el cálculo de struts está en `layout.js` (`_updateRegions`) | 50.0 |
| `Main.layoutManager.primaryMonitor`, señal `monitors-changed` | `dockLayout.js` | Bajo | 50.0 |
| `Main.overview.dash`, `isDummy`, `visible`, `showApps()`, `hide()` | `nativeDash.js`, `dockView.js`, `dockItem.js` | Medio: la vista general usa la altura del dash para su layout (`overviewControls.js`) | 50.0 |
| `Main.notify(título, cuerpo)` | `nativeDash.js` | Bajo | 50.0 |
| `AppFavorites.getAppFavorites()`: `getFavorites()`, señal `changed` | `appModel.js` | Bajo | 50.0 |
| `EventEmitter` (`misc/signals.js`) | `appModel.js` | Bajo | 50.0 |
| `Shell.AppSystem`, `Shell.App`: `activate()`, `open_new_window()`, `create_icon_texture()` | `appModel.js`, `dockItem.js` | Bajo (API GObject) | 50.0 |
| `Shell.AppSystem.get_running()`, señal `app-state-changed` | `appModel.js` | Bajo (API GObject) | 50.0 |
| `Shell.App`: `get_windows()`, señal `windows-changed`, `notify::state` | `dockItem.js` | Bajo (API GObject) | 50.0 |
| `Shell.WindowTracker.focus_app`, `notify::focus-app` | `appModel.js` | Bajo (API GObject) | 50.0 |
| `connectObject()` (`misc/signalTracker.js`) | `dockItem.js` | Bajo | 50.0 |

| `AppMenu(source, St.Side, {favoritesSection, showSingleWindows})`, `setApp()` | `dockMenu.js` | Medio: clase interna de `ui/appMenu.js` | 50.0 |
| `PopupMenu.PopupMenuManager`, `BoxPointer.PopupAnimation` | `dockMenu.js` | Bajo | 50.0 |
| `Clutter.ClickGesture`, `Clutter.LongPressGesture` | `dockItem.js` | Bajo (API GObject, nueva en 50) | 50.0 |
| `DND.makeDraggable()`, `addDragMonitor()`, `DragMotionResult`, `_delegate` con `getDragActor()`, `handleDragOver()`, `acceptDrop()` | `dockItem.js`, `dockView.js` | Medio: `ui/dnd.js` cambió a gestos (`St.DndStartGesture`) en versiones recientes | 50.0 |
| `Dash.Dash.getAppFromSource()`, señales `item-drag-begin/end/cancelled` de `Main.overview` | `dockView.js` | Medio | 50.0 |
| `AppFavorites`: `moveFavoriteToPos()`, `addFavoriteAtPos()`, `isFavorite()` | `dockView.js` | Bajo | 50.0 |
| `Main.layoutManager.addTopChrome()`; clase de tema `dash-label` | `dockLabel.js` | Bajo; en 50 `addChrome` solo admite `trackFullscreen` y `affectsStruts` | 50.0 |
| `Meta.Window`: `minimize()`, `unminimize()`, `can_minimize()`, `located_on_workspace()`; `Main.activateWindow()` | `dockItem.js` | Bajo | 50.0 |
| `PopupMenu.PopupMenu`, `PopupSwitchMenuItem`, `PopupSeparatorMenuItem`, `Ornament.DOT`/`NO_DOT`; `global.stage.get_event_actor()`; `Extension.openPreferences()` | `dockSettingsMenu.js`, `dockView.js`, `dockFeature.js` | Bajo | 50.0 |
| `global.backend.get_monitor_manager()`: `get_monitor_for_connector()`, `get_monitors()` | `dockLayout.js` | Bajo (API GObject) | 50.0 |
| `Background.BackgroundManager`, `Meta.BackgroundGroup` | `overviewBackdrop.js` | Medio: clase interna de `ui/background.js` | 50.0 |
| `Main.overview._overview.controls._stateAdjustment` | `overviewBackdrop.js` | Alto: propiedad privada (la usa también Dash to Dock); si falta, el fondo se muestra sin desvanecerse | 50.0 |
| `Main.getStyleVariant()`, `St.Settings` `notify::color-scheme` | `dockView.js` | Medio: `getStyleVariant` es interna de `ui/main.js` | 50.0 |
| `St.Adjustment` con `actor` y `ease()` (añadido por `ui/environment.js`) | `magnifier.js` | Bajo | 50.0 |
| `Main.layoutManager.removeChrome()` + `addChrome()` para cambiar `affectsStruts` | `dockLayout.js` | Medio: los struts se calculan con la posición transformada del actor (`layout.js` `_updateRegions`) | 50.0 |
| `global.display` `window-created`, `restacked`; `Meta.Window` `position-changed`, `size-changed`, `workspace-changed`, `unmanaged`, `showing_on_its_workspace()`, `get_frame_rect()` | `dockVisibility.js` | Bajo (API GObject) | 50.0 |

## Al portar a una versión nueva de GNOME Shell

1. Añadir la versión a `shell-version` en `metadata.json`.
2. Revisar los archivos de las tablas anteriores contra las fuentes de la nueva versión.
3. Pasar la lista de comprobación de [DEVELOPMENT.md](DEVELOPMENT.md).
4. Actualizar las tablas de este documento.
