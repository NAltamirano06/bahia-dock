/* features/dock/dockView.js
 *
 * Contenedor visual del dock: la "píldora" vertical con los iconos y,
 * al final, el botón que abre la cuadrícula de aplicaciones (sustituye
 * al que había en el dash nativo).
 *
 * Solo refleja el estado de AppModel; no decide qué aplicaciones hay.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {DockItem} from './dockItem.js';

export const MAX_ICON_SIZE = 48;
export const MIN_ICON_SIZE = 24;

export const DockView = GObject.registerClass(
class BahiaDockView extends St.BoxLayout {
    _init() {
        super._init({
            style_class: 'bahia-dock',
            orientation: Clutter.Orientation.VERTICAL,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
            reactive: true,
        });

        this._iconSize = MAX_ICON_SIZE;
        this._items = new Map();

        this._appsBox = new St.BoxLayout({
            style_class: 'bahia-dock-apps',
            orientation: Clutter.Orientation.VERTICAL,
        });
        this.add_child(this._appsBox);

        this._separator = new St.Widget({style_class: 'bahia-dock-separator'});
        this.add_child(this._separator);

        this._showAppsButton = new St.Button({
            style_class: 'bahia-dock-item bahia-dock-show-apps',
            reactive: true,
            can_focus: true,
            track_hover: true,
            accessible_name: 'Mostrar aplicaciones',
        });
        this._showAppsIcon = new St.Icon({
            icon_name: 'view-app-grid-symbolic',
            style_class: 'bahia-dock-show-apps-icon',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        // Caja del mismo tamaño que un icono de app, para alinear el botón.
        this._showAppsBin = new St.Bin({child: this._showAppsIcon});
        this._showAppsButton.set_child(this._showAppsBin);
        this._showAppsButton.connect('clicked', () => {
            if (Main.overview.visible && Main.overview.dash?.showAppsButton?.checked)
                Main.overview.hide();
            else
                Main.overview.showApps();
        });
        this.add_child(this._showAppsButton);

        this._applyIconSize();
    }

    /** Número de botones que ocupan una fila (apps + cuadrícula). */
    get itemCount() {
        return this._items.size + 1;
    }

    get iconSize() {
        return this._iconSize;
    }

    /**
     * Sincroniza los iconos con la lista de aplicaciones, reutilizando
     * los que ya existen para no recrear texturas sin necesidad.
     *
     * @param {Shell.App[]} apps - aplicaciones en orden
     */
    setApps(apps) {
        const wanted = new Set(apps.map(app => app.get_id()));

        for (const [id, item] of this._items) {
            if (!wanted.has(id)) {
                item.destroy();
                this._items.delete(id);
            }
        }

        apps.forEach((app, index) => {
            const id = app.get_id();
            let item = this._items.get(id);
            if (!item) {
                item = new DockItem(app, this._iconSize);
                this._items.set(id, item);
                this._appsBox.insert_child_at_index(item, index);
            } else if (this._appsBox.get_child_at_index(index) !== item) {
                this._appsBox.set_child_at_index(item, index);
            }
        });

        this._separator.visible = this._items.size > 0;
    }

    /**
     * @param {number} size - tamaño lógico de icono
     */
    setIconSize(size) {
        size = Math.max(MIN_ICON_SIZE, Math.min(MAX_ICON_SIZE, Math.floor(size)));
        if (size === this._iconSize)
            return;

        this._iconSize = size;
        this._applyIconSize();
    }

    _applyIconSize() {
        for (const item of this._items.values())
            item.setIconSize(this._iconSize);
        // El icono simbólico se ve mejor algo más pequeño que los de color.
        this._showAppsIcon.icon_size = Math.round(this._iconSize * 0.6);
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._showAppsBin.set_size(this._iconSize * scale, this._iconSize * scale);
    }
});
