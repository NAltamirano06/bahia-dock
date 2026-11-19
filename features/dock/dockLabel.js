/* features/dock/dockLabel.js
 *
 * Etiqueta con el nombre de la aplicación al pasar el puntero por un
 * icono, a la derecha del dock. Se comporta como la del dash nativo:
 *
 *   - aparece tras HOVER_TIMEOUT ms sobre un icono;
 *   - si ya había una visible, al pasar a otro icono cambia al instante;
 *   - tras salir del dock, vuelve a esperar HOVER_TIMEOUT ms.
 *
 * Hay una sola etiqueta para todo el dock. Usa la clase "dash-label" del
 * tema de GNOME para verse igual que la del dash.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const HOVER_TIMEOUT = 300;
const SHOW_TIME = 150;
const HIDE_TIME = 100;

export class DockLabel {
    /**
     * @param {Clutter.Actor} anchor - la píldora; la etiqueta se coloca
     *     a su derecha
     */
    constructor(anchor) {
        this._anchor = anchor;
        this._item = null;
        this._text = '';
        this._showing = false;
        this._showId = 0;
        this._resetId = 0;

        this.actor = new St.Label({style_class: 'dash-label bahia-dock-label'});
        this.actor.hide();
        // Por encima de las ventanas y de la vista general. No es
        // reactiva, así que no recibe clics ni ocupa región de entrada.
        Main.layoutManager.addTopChrome(this.actor);
    }

    /** Texto visible ahora mismo, o null (para la prueba automática). */
    get visibleText() {
        return this.actor.visible && this.actor.opacity > 0 ? this.actor.text : null;
    }

    /**
     * Muestra u oculta la etiqueta de un icono según su estado.
     *
     * @param {St.Widget} item - icono que cambió de estado
     * @param {boolean} wanted - si debe mostrarse
     * @param {string} text - texto de la etiqueta
     */
    sync(item, wanted, text) {
        if (wanted) {
            this._item = item;
            this._text = text;
            this._clearReset();
            this._clearShow();
            if (this._showing) {
                this._show();
            } else {
                this._showId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HOVER_TIMEOUT, () => {
                    this._showId = 0;
                    this._showing = true;
                    this._show();
                    return GLib.SOURCE_REMOVE;
                });
            }
        } else if (item === this._item) {
            this.hide();
        }
    }

    /** Oculta la etiqueta y deja de esperar para mostrarla. */
    hide() {
        this._clearShow();
        this._item = null;
        this.actor.remove_all_transitions();
        this.actor.ease({
            opacity: 0,
            duration: HIDE_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.actor?.hide(),
        });

        if (this._showing && !this._resetId) {
            this._resetId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, HOVER_TIMEOUT, () => {
                this._resetId = 0;
                this._showing = false;
                return GLib.SOURCE_REMOVE;
            });
        }
    }

    _show() {
        const item = this._item;
        if (!item)
            return;

        this.actor.remove_all_transitions();
        this.actor.text = this._text;
        if (!this.actor.visible) {
            this.actor.opacity = 0;
            this.actor.show();
        }

        const [anchorX] = this._anchor.get_transformed_position();
        const [anchorWidth] = this._anchor.get_transformed_size();
        const [, itemY] = item.get_transformed_position();
        const [, itemHeight] = item.get_transformed_size();
        const offset = this.actor.get_theme_node().get_length('-x-offset');
        const labelHeight = this.actor.height;

        const x = Math.floor(anchorX + anchorWidth + offset);
        const y = Math.clamp(Math.floor(itemY + (itemHeight - labelHeight) / 2),
            0, global.stage.height - labelHeight);
        this.actor.set_position(x, y);

        this.actor.ease({
            opacity: 255,
            duration: SHOW_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    _clearShow() {
        if (this._showId) {
            GLib.source_remove(this._showId);
            this._showId = 0;
        }
    }

    _clearReset() {
        if (this._resetId) {
            GLib.source_remove(this._resetId);
            this._resetId = 0;
        }
    }

    destroy() {
        this._clearShow();
        this._clearReset();
        // Destruir el actor también lo retira de layoutManager.
        this.actor.destroy();
        this.actor = null;
        this._anchor = null;
        this._item = null;
    }
}
