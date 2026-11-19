/* features/dock/dockMenu.js
 *
 * Menú contextual de un icono del dock. Reutiliza el AppMenu de GNOME
 * Shell, el mismo del dash y la cuadrícula de aplicaciones: ventanas
 * abiertas, nueva ventana, acciones de la app, fijar o quitar de
 * favoritas, detalles y salir.
 *
 * Se abre a la derecha del icono (la flecha apunta a la izquierda, hacia
 * el dock). El menú se crea la primera vez que se abre.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import St from 'gi://St';

import {AppMenu} from 'resource:///org/gnome/shell/ui/appMenu.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

export class DockMenu {
    /**
     * @param {DockItem} item - icono al que se ancla el menú
     * @param {Function} onStateChanged - recibe true al abrir y false al cerrar
     */
    constructor(item, onStateChanged) {
        this._item = item;
        this._onStateChanged = onStateChanged;
        this._manager = new PopupMenu.PopupMenuManager(item);
        this._menu = null;
    }

    get isOpen() {
        return this._menu?.isOpen ?? false;
    }

    open() {
        if (!this._menu) {
            // St.Side.LEFT: la flecha está en el lado izquierdo del
            // menú, así que el menú queda a la derecha del icono.
            this._menu = new AppMenu(this._item, St.Side.LEFT, {
                favoritesSection: true,
                showSingleWindows: true,
            });
            this._menu.setApp(this._item.app);
            this._menu.connect('open-state-changed',
                (_menu, isOpen) => this._onStateChanged(isOpen));
            Main.overview.connectObject('hiding', () => this.close(), this._menu.actor);
            Main.uiGroup.add_child(this._menu.actor);
            this._manager.addMenu(this._menu);
        }

        this._menu.open(BoxPointer.PopupAnimation.FULL);
    }

    close() {
        this._menu?.close();
    }

    /**
     * Mueve el foco del teclado al primer elemento del menú abierto.
     */
    focusFirstItem() {
        this._menu?.actor.navigate_focus(null, St.DirectionType.TAB_FORWARD, false);
    }

    destroy() {
        // PopupMenu.destroy() destruye su actor y el gestor lo olvida
        // con la señal "destroy" del menú.
        this._menu?.destroy();
        this._menu = null;
        this._manager = null;
        this._item = null;
    }
}
