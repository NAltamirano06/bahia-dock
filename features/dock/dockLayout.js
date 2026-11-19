/* features/dock/dockLayout.js
 *
 * Coloca el dock en el monitor principal y reserva su espacio.
 *
 * Usa dos actores:
 *
 *   area  St.Widget transparente pegado al borde izquierdo, de la altura
 *         completa del monitor. Se registra con addChrome() y
 *         affectsStruts, así GNOME Shell crea un "strut" en el lado
 *         izquierdo y las ventanas maximizadas empiezan a su derecha.
 *         Un actor que no toca el borde no reserva espacio; por eso el
 *         área ocupa toda la altura aunque el dock sea flotante.
 *
 *   view  La píldora visual (DockView), hija del área, centrada en
 *         vertical y separada del borde por el padding del área.
 *
 * Así, la parte visual (magnificación y ocultado, Fase 4) no altera el
 * espacio reservado ni recoloca las ventanas.
 *
 * Con el ocultado automático el área deja de reservar espacio
 * (setAffectsStruts(false)): GNOME Shell solo lee affectsStruts al
 * registrar el actor, así que se retira y se vuelve a registrar.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {MAX_ICON_SIZE} from './dockView.js';

export class DockLayout {
    /**
     * @param {DockView} view - contenedor visual que se colocará
     * @param {Lifecycle} lifecycle - registro de señales del módulo
     */
    constructor(view, lifecycle) {
        this._view = view;

        this.area = new St.Widget({
            name: 'bahiaDockArea',
            style_class: 'bahia-dock-area',
            layout_manager: new Clutter.BinLayout(),
            reactive: false,
        });
        this.area.add_child(view);

        this._affectsStruts = true;
        Main.layoutManager.addChrome(this.area, {
            affectsStruts: true,
            trackFullscreen: true,
        });

        lifecycle.connect(Main.layoutManager, 'monitors-changed',
            () => this.update());
        lifecycle.connect(St.ThemeContext.get_for_stage(global.stage),
            'notify::scale-factor', () => this.update());

        this.update();
    }

    /** Monitor donde está el dock. */
    get monitor() {
        return Main.layoutManager.primaryMonitor;
    }

    /**
     * @param {boolean} affectsStruts - si el área reserva espacio
     */
    setAffectsStruts(affectsStruts) {
        if (affectsStruts === this._affectsStruts)
            return;

        this._affectsStruts = affectsStruts;
        Main.layoutManager.removeChrome(this.area);
        Main.layoutManager.addChrome(this.area, {
            affectsStruts,
            trackFullscreen: true,
        });
        this.update();
    }

    /** Recoloca el área y ajusta el tamaño de los iconos al monitor. */
    update() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;

        this.area.set_position(monitor.x, monitor.y);
        this.area.set_height(monitor.height);
        this._fitIconSize(monitor);
    }

    /**
     * Reduce los iconos si no caben todos en la altura del monitor.
     *
     * @param {object} monitor - monitor de Main.layoutManager
     */
    _fitIconSize(monitor) {
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const count = Math.max(1, this._view.itemCount);
        // Espacio de cada botón además del icono: padding (12) y separación (4)
        // definidos en stylesheet.css (en píxeles lógicos), más el
        // margen superior e inferior de la píldora y la franja de cada
        // separador (1px + 12px de margen).
        const perItemExtra = 16;
        const verticalMargins = 64;
        const perSeparator = 13;
        const available = monitor.height / scale - verticalMargins -
            perSeparator * this._view.separatorCount;
        const fit = available / count - perItemExtra;
        this._view.setIconSize(Math.min(MAX_ICON_SIZE, fit));
    }

    destroy() {
        // removeChrome deja de rastrear el actor y retira el strut.
        Main.layoutManager.removeChrome(this.area);
        this.area.destroy();
        this.area = null;
        this._view = null;
    }
}
