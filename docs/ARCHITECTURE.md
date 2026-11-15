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

Estructura prevista del dock:

```text
features/dock/
├── dockFeature.js   Coordina el módulo
├── appModel.js      Favoritas + abiertas, sin interfaz
├── dockLayout.js    Monitor, posición y espacio reservado
├── dockView.js      Contenedor visual
├── dockItem.js      Icono, indicador y clics
├── dockMenu.js      Menú contextual
└── magnifier.js     Magnificación (Fase 4)
```

## Decisiones de diseño del dock

- **Espacio reservado:** el dock reserva una franja en el borde izquierdo y las ventanas maximizadas empiezan a su derecha. El actor que reserva el espacio está pegado al borde y es distinto del actor visual, para que la magnificación y el autoocultado no recoloquen las ventanas.
- **Forma:** panel flotante centrado en vertical.
- **Dash nativo:** se oculta en la vista general mientras la extensión está activa, se informa con una notificación y se restaura al desactivarla.
