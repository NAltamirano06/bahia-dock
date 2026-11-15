/* features/dock/appModel.js
 *
 * Modelo de las aplicaciones que muestra el dock. No crea actores: solo
 * mantiene la lista y avisa con la señal "changed" cuando cambia.
 *
 * Fase 1: solo las favoritas de GNOME (org.gnome.shell favorite-apps).
 * Fase 2: añadirá las aplicaciones abiertas que no son favoritas.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Shell from 'gi://Shell';

import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

export class AppModel extends EventEmitter {
    /**
     * @param {Lifecycle} lifecycle - registro de señales del módulo
     */
    constructor(lifecycle) {
        super();
        this._favorites = AppFavorites.getAppFavorites();
        this._appSystem = Shell.AppSystem.get_default();
        this._apps = [];

        lifecycle.connect(this._favorites, 'changed', () => this._refresh());
        lifecycle.connect(this._appSystem, 'installed-changed', () => this._refresh());
        this._refresh();
    }

    /** @returns {Shell.App[]} aplicaciones en el orden del dock */
    get apps() {
        return this._apps;
    }

    _refresh() {
        const apps = this._favorites.getFavorites();
        const same = apps.length === this._apps.length &&
            apps.every((app, i) => app === this._apps[i]);
        if (same)
            return;

        this._apps = apps;
        this.emit('changed');
    }

    destroy() {
        this.disconnectAll();
        this._apps = [];
    }
}
