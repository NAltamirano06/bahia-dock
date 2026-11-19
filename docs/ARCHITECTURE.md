# Arquitectura

Bahía Dock es una sola extensión formada por **módulos independientes** (features). Cada módulo se activa o desactiva por separado y un fallo en uno no afecta a los demás.

## Flujo de activación

```text
extension.js
  └── FeatureManager            (core/featureManager.js)
        ├── lee "<id>-enabled" en GSettings
        ├── activa cada módulo dentro de try/catch
        └── escucha cambios del interruptor y reacciona en caliente
              └── DockFeature   (features/dock/dockFeature.js)
```

Al desactivar la extensión, `FeatureManager` desactiva los módulos en orden inverso.

## Capas

| Carpeta | Responsabilidad | Puede importar |
|---|---|---|
| `extension.js` | Crea el gestor y registra los módulos | `core/`, `features/*/…Feature.js` |
| `core/` | Contrato de módulos, gestor, ciclo de vida y registro | GJS y GNOME Shell |
| `features/<módulo>/` | Una funcionalidad completa | `core/`, GJS y GNOME Shell |
| `prefs.js`, `prefs/` | Preferencias (proceso aparte): una página por archivo y filas comunes en `prefs/rows.js` | GTK y Adwaita, **nunca** `resource:///org/gnome/shell/ui/` |

**Regla:** un módulo nunca importa a otro. Lo que necesiten compartir va a `core/`.

## Contrato de un módulo

```js
import {Feature} from '../../core/feature.js';

export class MiModulo extends Feature {
    static id = 'mi-modulo';      // interruptor: "mi-modulo-enabled"

    _onEnable() {
        // Crear actores y conectar señales con this.lifecycle
        this.lifecycle.connect(objeto, 'señal', () => {});
    }

    _onDisable() {
        // Destruir los actores creados en _onEnable()
    }
}
```

Para añadir un módulo:
1. Crear `features/<id>/<id>Feature.js` heredando de `Feature`.
2. Añadir la clave `<id>-enabled` al esquema en `schemas/`.
3. Registrarlo en la lista `features` de `extension.js`.

## Limpieza

`core/lifecycle.js` registra cada señal, temporizador o función de limpieza. Al desactivar el módulo se deshace todo en orden inverso. GNOME Shell desactiva las extensiones al bloquear la pantalla, así que este ciclo ocurre a menudo y no debe dejar restos.

## Registro

`core/logger.js` usa el logger de GNOME Shell, que antepone `[Bahía Dock]`, y añade el módulo:

```text
[Bahía Dock] (dock) Activado
```

Los mensajes de depuración solo aparecen con la clave `debug-logging` activada.

## Estilos

Todas las clases CSS llevan prefijo para no chocar con el tema:

- `bahia-dock-*`: módulo del dock.
- `bahia-window-*`: módulo futuro de ventanas.

## Módulos previstos

| Módulo | Carpeta | Fase |
|---|---|---|
| Dock | `features/dock/` | 1 a 5 |
| Ventanas | `features/windows/` | 6 |

Estructura del dock (✓ = existe):

```text
features/dock/
├── dockFeature.js   ✓ Coordina el módulo
├── appModel.js      ✓ Favoritas, abiertas no favoritas y foco, sin interfaz
├── dockLayout.js    ✓ Monitor, posición y espacio reservado
├── dockView.js      ✓ Píldora: favoritas, abiertas, botón de aplicaciones y destino del arrastre
├── dockItem.js      ✓ Icono, indicadores, foco, clics, minimizar y origen del arrastre
├── dockMenu.js      ✓ Menú contextual (AppMenu de GNOME)
├── dockLabel.js     ✓ Etiqueta con el nombre de la app
├── dockSettingsMenu.js ✓ Menú de configuración (visibilidad, magnificación, preferencias)
├── magnifier.js     ✓ Magnificación de iconos
├── dockVisibility.js ✓ Siempre visible, ocultado automático e intellihide
├── overviewBackdrop.js ✓ Fondo de pantalla bajo el dock al abrir la vista general
├── nativeDash.js    ✓ Oculta y restaura el dash de la vista general
```

### Cómo se reserva el espacio

```text
borde izquierdo
│◄── área (≈94 px a 1x con magnificación 1,3; 80 px sin ella) ──►│
│ padding │   píldora (DockView)   │ padding │  ventanas maximizadas →
│  4 px   │                        │  2 px   │
```

- **Área** (`DockLayout.area`): `St.Widget` transparente, altura completa del monitor, registrado con `Main.layoutManager.addChrome(area, {affectsStruts: true, trackFullscreen: true})`. Como toca el borde izquierdo de arriba abajo, GNOME Shell crea un strut `LEFT` del ancho del área y lo resta del área de trabajo.
- **Píldora** (`DockView`): hija del área, centrada en vertical. Puede cambiar de aspecto sin mover las ventanas, siempre que no cambie el ancho del área.
- **Pantalla completa:** `trackFullscreen` oculta el área cuando hay una ventana a pantalla completa en el monitor.
- **Varios monitores:** en la Fase 1 el dock solo está en el monitor principal. Se recoloca con `monitors-changed`.

### Preferencias y monitores (Fase 5)

- **Ajustes en caliente:** cada pieza escucha las claves que le afectan (`changed::`, conectadas con el `lifecycle`). `DockLayout` recoloca el área con `dock-monitor`, `dock-icon-size` y `dock-edge-margin` y emite `updated`; `DockVisibility`, `OverviewBackdrop` y `Magnifier` reaccionan a esa señal.
- **Monitor:** `DockLayout.monitor` resuelve el conector guardado con `global.backend.get_monitor_manager().get_monitor_for_connector()` y vuelve al principal si no está conectado. La página de preferencias lista los monitores de GDK por su conector, que es el mismo nombre.
- **Apariencia:** la opacidad se aplica con `set_style()` en la píldora (colores claro u oscuro según la variante) y el margen con `set_style()` en el área. Sin el botón de aplicaciones, `DockView` vuelve a crear el menú de configuración anclado a la píldora.
- **Fondo en la vista general:** durante la animación GNOME dibuja el fondo del escritorio con `WorkspaceBackground`, recortado al área de trabajo, así que la franja reservada por el dock quedaba gris. `OverviewBackdrop` pone debajo del área un `Meta.BackgroundGroup` con el fondo del monitor, recortado a la franja, con opacidad `1 − estado` de `Main.overview._overview.controls._stateAdjustment`. Solo se ve con la vista general abierta y en modo siempre visible.

### Interacción (Fase 3)

- **Menú:** `DockMenu` crea el `AppMenu` de GNOME la primera vez que se abre, con `St.Side.LEFT` para que quede a la derecha del icono. Se abre con clic derecho (`Clutter.ClickGesture`), pulsación larga (`Clutter.LongPressGesture`) o la señal `popup-menu` del teclado.
- **Etiqueta:** una sola `DockLabel` para todo el dock, en `addTopChrome`, con la clase `dash-label` del tema. `DockView` la sincroniza con `notify::hover` de cada icono y la oculta con el menú abierto o durante un arrastre.
- **Arrastre:** cada `DockItem` es arrastrable con `DND.makeDraggable()` y su `_delegate` es él mismo. `DockView` es el destino (`handleDragOver`/`acceptDrop`) y acepta también iconos de la cuadrícula (`Dash.getAppFromSource`), cuyo arrastre sigue con las señales `item-drag-*` de la vista general. Solo hay hueco en la zona de favoritas; fuera de ella el icono vuelve a su sitio. El cambio se guarda con `AppFavorites.moveFavoriteToPos()` o `addFavoriteAtPos()` antes del siguiente repintado, como el dash nativo.
- **Minimizar:** si todas las ventanas de la app en el escritorio actual están minimizadas, un clic las restaura; si no, y la app tiene el foco, las minimiza. El orden importa: al minimizar la última ventana, `focus_app` puede seguir apuntando a la app.

### Estética y visibilidad (Fase 4)

- **Tema:** `DockView` añade la clase `bahia-dock-light` cuando `Main.getStyleVariant()` devuelve `light` y escucha `notify::color-scheme` de `St.Settings`. Hay una sola hoja de estilos; las reglas claras van con ese prefijo.
- **Magnificación:** `Magnifier` escucha `motion-event` y `notify::hover` de la píldora. Calcula la escala de cada icono con una curva coseno según su distancia al puntero, medida sobre las posiciones **en reposo** guardadas al entrar; así los iconos no tiemblan al moverse. `DockItem.setMagnification()` escala el icono desde su centro y solo aumenta la altura del botón. El hueco de cada icono ya mide el ancho del icono a tamaño máximo (`setMagnificationRoom()`), así que el icono no se sale de la píldora y magnificar no cambia el espacio reservado; solo cambia al activar, desactivar o cambiar el tamaño máximo. Si la píldora no cabe en la pantalla al crecer, se reduce el crecimiento. Un `St.Adjustment` animado suaviza la entrada y la salida.
- **Menú de configuración:** `DockSettingsMenu` es un `PopupMenu` anclado al botón de la cuadrícula. Se abre con un `Clutter.ClickGesture` (botón secundario) o un `Clutter.LongPressGesture` en ese botón, y con `button-press-event` de la píldora cuando el actor del evento es la propia píldora (separadores y cajas no son reactivos, así que los clics en zonas vacías llegan a ella). Escribe las mismas claves de GSettings que `prefs.js` y se sincroniza con `changed::`. "Preferencias del dock…" llama a `Extension.openPreferences()`.
- **Visibilidad:** `DockVisibility` cambia `affectsStruts` del área (`DockLayout.setAffectsStruts()`, que retira y vuelve a registrar el actor) y esconde la píldora con `translation_x` y `opacity`, sin tocar el área. En los modos con ocultado añade una franja reactiva de 1 px en el borde izquierdo. Intellihide vigila las ventanas del escritorio activo (`position-changed`, `size-changed`, `notify::minimized`, `restacked`...) y agrupa las comprobaciones en un idle.

## Decisiones de diseño del dock

- **Espacio reservado:** el dock reserva una franja en el borde izquierdo y las ventanas maximizadas empiezan a su derecha. El actor que reserva el espacio está pegado al borde y es distinto del actor visual, para que la magnificación y el autoocultado no recoloquen las ventanas.
- **Forma:** panel flotante centrado en vertical.
- **Dash nativo:** se oculta en la vista general mientras la extensión está activa, se informa con una notificación y se restaura al desactivarla.
