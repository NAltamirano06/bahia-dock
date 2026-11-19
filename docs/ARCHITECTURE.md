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
| `prefs.js` | Preferencias (proceso aparte) | GTK y Adwaita, **nunca** `resource:///org/gnome/shell/ui/` |

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
├── nativeDash.js    ✓ Oculta y restaura el dash de la vista general
└── magnifier.js       Magnificación (Fase 4)
```

### Cómo se reserva el espacio

```text
borde izquierdo
│◄──────── área (80 px a 1x) ────────►│
│ padding │   píldora (DockView)   │ padding │  ventanas maximizadas →
│  4 px   │                        │  2 px   │
```

- **Área** (`DockLayout.area`): `St.Widget` transparente, altura completa del monitor, registrado con `Main.layoutManager.addChrome(area, {affectsStruts: true, trackFullscreen: true})`. Como toca el borde izquierdo de arriba abajo, GNOME Shell crea un strut `LEFT` del ancho del área y lo resta del área de trabajo.
- **Píldora** (`DockView`): hija del área, centrada en vertical. Puede cambiar de aspecto sin mover las ventanas, siempre que no cambie el ancho del área.
- **Pantalla completa:** `trackFullscreen` oculta el área cuando hay una ventana a pantalla completa en el monitor.
- **Varios monitores:** en la Fase 1 el dock solo está en el monitor principal. Se recoloca con `monitors-changed`.

### Interacción (Fase 3)

- **Menú:** `DockMenu` crea el `AppMenu` de GNOME la primera vez que se abre, con `St.Side.LEFT` para que quede a la derecha del icono. Se abre con clic derecho (`Clutter.ClickGesture`), pulsación larga (`Clutter.LongPressGesture`) o la señal `popup-menu` del teclado.
- **Etiqueta:** una sola `DockLabel` para todo el dock, en `addTopChrome`, con la clase `dash-label` del tema. `DockView` la sincroniza con `notify::hover` de cada icono y la oculta con el menú abierto o durante un arrastre.
- **Arrastre:** cada `DockItem` es arrastrable con `DND.makeDraggable()` y su `_delegate` es él mismo. `DockView` es el destino (`handleDragOver`/`acceptDrop`) y acepta también iconos de la cuadrícula (`Dash.getAppFromSource`), cuyo arrastre sigue con las señales `item-drag-*` de la vista general. Solo hay hueco en la zona de favoritas; fuera de ella el icono vuelve a su sitio. El cambio se guarda con `AppFavorites.moveFavoriteToPos()` o `addFavoriteAtPos()` antes del siguiente repintado, como el dash nativo.
- **Minimizar:** si todas las ventanas de la app en el escritorio actual están minimizadas, un clic las restaura; si no, y la app tiene el foco, las minimiza. El orden importa: al minimizar la última ventana, `focus_app` puede seguir apuntando a la app.

## Decisiones de diseño del dock

- **Espacio reservado:** el dock reserva una franja en el borde izquierdo y las ventanas maximizadas empiezan a su derecha. El actor que reserva el espacio está pegado al borde y es distinto del actor visual, para que la magnificación y el autoocultado no recoloquen las ventanas.
- **Forma:** panel flotante centrado en vertical.
- **Dash nativo:** se oculta en la vista general mientras la extensión está activa, se informa con una notificación y se restaura al desactivarla.
