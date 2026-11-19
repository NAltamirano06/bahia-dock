/* features/dock/overviewBackdrop.js
 *
 * Fondo de pantalla bajo el dock mientras se abre o se cierra la vista
 * general.
 *
 * El problema: durante la animación, GNOME Shell dibuja el fondo del
 * escritorio con WorkspaceBackground (ui/workspace.js), recortado al
 * área de trabajo. Con el espacio reservado del dock, el área de trabajo
 * empieza a la derecha del dock, así que la franja del dock pasa de
 * golpe al gris de la vista general y se ve un corte justo en su borde.
 * En la barra superior pasa lo mismo, pero allí no se nota porque es
 * opaca.
 *
 * La solución: un actor con el fondo de pantalla real del monitor,
 * recortado a la franja del dock y colocado justo debajo del área del
 * dock. Su opacidad sigue al estado de la vista general: entera en el
 * escritorio y nula con la vista general abierta, así que se desvanece
 * al mismo ritmo que el escritorio se encoge.
 *
 * Solo se muestra con la vista general visible y el área reservando
 * espacio; en los modos con ocultado no hay corte.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';

import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class OverviewBackdrop {
    /**
     * @param {DockLayout} layout - área y monitor del dock
     * @param {Lifecycle} lifecycle - registro de señales del módulo
     */
    constructor(layout, lifecycle) {
        this._layout = layout;
        this._bgManager = null;
        this._monitorIndex = -1;

        this.actor = new Clutter.Actor({
            name: 'bahiaDockBackdrop',
            clip_to_allocation: true,
            reactive: false,
            visible: false,
        });
        this._group = new Meta.BackgroundGroup({
            layout_manager: new Clutter.BinLayout(),
        });
        this.actor.add_child(this._group);

        Main.layoutManager.addChrome(this.actor);
        Main.layoutManager.uiGroup.set_child_below_sibling(this.actor, layout.area);

        // Estado de la vista general: 0 escritorio, 1 ventanas, 2
        // aplicaciones. Es privado, pero estable desde GNOME 40.
        this._state = Main.overview._overview?.controls?._stateAdjustment ?? null;
        if (this._state)
            lifecycle.connect(this._state, 'notify::value', () => this._sync());

        lifecycle.connect(Main.overview, 'showing', () => this._sync());
        lifecycle.connect(Main.overview, 'hidden', () => this._sync());
        lifecycle.connect(layout, 'updated', () => this._place());
        lifecycle.connect(layout.area, 'notify::width', () => this._place());

        this._place();
    }

    /** Si se está mostrando (para la prueba automática). */
    get visible() {
        return this.actor.visible;
    }

    /** Coloca la franja sobre el área del dock y carga el fondo de su monitor. */
    _place() {
        const monitor = this._layout.monitor;
        if (!monitor)
            return;

        this.actor.set_position(monitor.x, monitor.y);
        this.actor.set_size(this._layout.area.width, monitor.height);
        // El fondo ocupa todo el monitor; el recorte deja ver solo la franja.
        this._group.set_size(monitor.width, monitor.height);

        if (monitor.index !== this._monitorIndex) {
            this._bgManager?.destroy();
            this._monitorIndex = monitor.index;
            this._bgManager = new Background.BackgroundManager({
                container: this._group,
                monitorIndex: monitor.index,
                controlPosition: false,
                useContentSize: false,
            });
        }

        // Al volver a registrar el área (cambio de modo) queda encima del
        // fondo, pero se asegura por si cambió el orden.
        if (this._layout.area.get_parent() === this.actor.get_parent())
            this.actor.get_parent().set_child_below_sibling(this.actor, this._layout.area);

        this._sync();
    }

    _sync() {
        const value = this._state?.value ?? (Main.overview.visible ? 1 : 0);
        const progress = Math.clamp(value, 0, 1);
        const wanted = Main.overview.visible && this._layout.affectsStruts && progress < 1;

        this.actor.visible = wanted;
        if (wanted)
            this.actor.opacity = Math.round(255 * (1 - progress));
    }

    destroy() {
        this._bgManager?.destroy();
        this._bgManager = null;
        // Destruir el actor también lo retira de layoutManager.
        this.actor.destroy();
        this.actor = null;
        this._group = null;
        this._layout = null;
    }
}
