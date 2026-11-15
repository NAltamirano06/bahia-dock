/* features/dock/dockItem.js
 *
 * Un icono del dock. Fase 1: icono y clic para abrir o enfocar la
 * aplicación. Los indicadores, el menú y el arrastre llegan en las
 * fases 2 y 3.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export const DockItem = GObject.registerClass(
class BahiaDockItem extends St.Button {
    /**
     * @param {Shell.App} app - aplicación que representa
     * @param {number} iconSize - tamaño lógico del icono en píxeles
     */
    _init(app, iconSize) {
        super._init({
            style_class: 'bahia-dock-item',
            reactive: true,
            can_focus: true,
            track_hover: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO,
            accessible_name: app.get_name(),
        });

        this.app = app;
        this._iconSize = 0;
        this.setIconSize(iconSize);
    }

    /**
     * @param {number} iconSize - tamaño lógico del icono en píxeles
     */
    setIconSize(iconSize) {
        if (iconSize === this._iconSize)
            return;

        this._iconSize = iconSize;
        this.set_child(this.app.create_icon_texture(iconSize));
    }

    vfunc_clicked(button) {
        // Igual que el dash nativo: Ctrl+clic o clic central abre una
        // ventana nueva si la aplicación ya está abierta.
        const event = Clutter.get_current_event();
        const modifiers = event ? event.get_state() : 0;
        const ctrl = (modifiers & Clutter.ModifierType.CONTROL_MASK) !== 0;
        const middle = button === Clutter.BUTTON_MIDDLE;
        const newWindow = this.app.can_open_new_window() &&
            this.app.state === Shell.AppState.RUNNING &&
            (ctrl || middle);

        if (newWindow)
            this.app.open_new_window(-1);
        else
            this.app.activate();

        Main.overview.hide();
    }
});
