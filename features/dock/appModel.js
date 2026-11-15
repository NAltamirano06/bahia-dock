/* features/dock/appModel.js
 *
 * Modelo de las aplicaciones que muestra el dock. No crea actores: solo
 * mantiene las listas y avisa con señales cuando cambian.
 *
 *   favorites  favoritas de GNOME (org.gnome.shell favorite-apps)
 *   running    aplicaciones abiertas que no son favoritas, en el orden
 *              en que se abrieron. El orden es estable: una app no cambia
 *              de sitio al recibir el foco, solo se añaden al final las
 *              nuevas y se retiran las que se cierran.
 *   focusApp   aplicación de la ventana con el foco, o null
 *
 * Señales:
 *   "changed"        cambió favorites o running
 *   "focus-changed"  cambió focusApp
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Shell from 'gi://Shell';

import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import {EventEmitter} from 'resource:///org/gnome/shell/misc/signals.js';

const sameList = (a, b) =>
    a.length === b.length && a.every((app, i) => app === b[i]);

export class AppModel extends EventEmitter {
    /**
     * @param {Lifecycle} lifecycle - registro de señales del módulo
     */
    constructor(lifecycle) {
        super();
        this._favorites = AppFavorites.getAppFavorites();
        this._appSystem = Shell.AppSystem.get_default();
        this._tracker = Shell.WindowTracker.get_default();
        this._favoriteApps = [];
        this._runningApps = [];
        this._focusApp = null;

        lifecycle.connect(this._favorites, 'changed', () => this._refresh());
        lifecycle.connect(this._appSystem, 'installed-changed', () => this._refresh());
        lifecycle.connect(this._appSystem, 'app-state-changed', () => this._refresh());
        lifecycle.connect(this._tracker, 'notify::focus-app', () => this._refreshFocus());
        this._refresh();
        this._refreshFocus();
    }

    /** @returns {Shell.App[]} favoritas, en el orden de GNOME */
    get favorites() {
        return this._favoriteApps;
    }

    /** @returns {Shell.App[]} abiertas no favoritas, en orden de apertura */
    get running() {
        return this._runningApps;
    }

    /** @returns {Shell.App|null} aplicación con el foco */
    get focusApp() {
        return this._focusApp;
    }

    _refresh() {
        const favorites = this._favorites.getFavorites();
        const favoriteIds = new Set(favorites.map(app => app.get_id()));

        // get_running() ordena por uso reciente; se conserva el orden
        // anterior y las apps nuevas se añaden al final.
        const open = this._appSystem.get_running()
            .filter(app => !favoriteIds.has(app.get_id()));
        const openSet = new Set(open);
        const running = this._runningApps.filter(app => openSet.has(app));
        for (const app of open) {
            if (!running.includes(app))
                running.push(app);
        }

        if (sameList(favorites, this._favoriteApps) &&
            sameList(running, this._runningApps))
            return;

        this._favoriteApps = favorites;
        this._runningApps = running;
        this.emit('changed');
    }

    _refreshFocus() {
        const app = this._tracker.focus_app;
        if (app === this._focusApp)
            return;

        this._focusApp = app;
        this.emit('focus-changed');
    }

    destroy() {
        this.disconnectAll();
        this._favoriteApps = [];
        this._runningApps = [];
        this._focusApp = null;
    }
}
