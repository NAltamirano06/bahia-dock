/* tools/test-probe/extension.js
 *
 * Extensión auxiliar SOLO para tools/headless-test.sh. No forma parte
 * de Bahía Dock ni se empaqueta. Al activarse:
 *
 *   1. Registra la geometría del dock, el área de trabajo y el dash.
 *   2. Maximiza las ventanas abiertas y registra su posición.
 *   3. Guarda capturas del escritorio y de la vista general en
 *      $XDG_RUNTIME_DIR/probe-*.png.
 *   4. Comprueba la etiqueta con el nombre, el menú contextual y el
 *      reordenado de favoritas arrastrando (Fase 3).
 *   5. Abre una app desde el dock y comprueba sus indicadores, el foco
 *      y minimizar y restaurar con clics; la quita de favoritas (solo
 *      en el entorno aislado de la prueba) para verla en la sección de
 *      abiertas, la vuelve a fijar arrastrándola, y la cierra.
 *
 * Todas las líneas que escribe empiezan por "PROBE ".
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

Gio._promisify(Shell.Screenshot.prototype, 'screenshot');

const wait = ms => new Promise(resolve => {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => {
        resolve();
        return GLib.SOURCE_REMOVE;
    });
});

const rect = r => `x=${r.x} y=${r.y} w=${r.width} h=${r.height}`;

export default class ProbeExtension extends Extension {
    enable() {
        this._cancelled = false;
        this._run().catch(e => console.log(`PROBE ERROR ${e}\n${e.stack}`));
    }

    disable() {
        this._cancelled = true;
    }

    async _run() {
        // GNOME arranca mostrando la vista general; se cierra para medir
        // y capturar el escritorio.
        Main.overview.hide();
        await wait(1500);
        this._report('inicio');
        await this._screenshot('escritorio');

        for (const win of global.display.list_all_windows()) {
            if (win.get_window_type() !== Meta.WindowType.NORMAL)
                continue;
            try {
                win.maximize();
            } catch {
                win.maximize(Meta.MaximizeFlags.BOTH);
            }
        }
        await wait(1500);
        for (const win of global.display.list_all_windows()) {
            if (win.get_window_type() !== Meta.WindowType.NORMAL)
                continue;
            console.log(`PROBE window "${win.get_title()}" maximized=${win.is_maximized()} frame ${rect(win.get_frame_rect())}`);
        }
        await this._screenshot('maximizada');

        Main.overview.show();
        await wait(2000);
        this._report('overview');
        await this._screenshot('overview');
        Main.overview.hide();
        await wait(1000);

        await this._checkLabelAndMenu();
        await this._checkReorder();
        await this._clickFirstStoppedApp();
        console.log('PROBE fin');
    }

    /** La píldora del dock (DockView). */
    _dockView() {
        const area = Main.layoutManager.uiGroup.get_children()
            .find(a => a.name === 'bahiaDockArea');
        return area?.get_first_child() ?? null;
    }

    /**
     * Coordenada vertical, en la píldora, del centro de un icono de
     * favoritas más un desplazamiento.
     */
    _favoriteY(item, delta) {
        const box = item.get_parent();
        return box.y + item.y + item.height / 2 + delta;
    }

    /** Etiqueta al pasar el puntero y menú contextual del primer icono. */
    async _checkLabelAndMenu() {
        const view = this._dockView();
        const item = this._dockItems()[0];
        if (!view || !item) {
            console.log('PROBE etiqueta sin iconos');
            return;
        }

        item.hover = true;
        await wait(800);
        console.log(`PROBE etiqueta[hover] "${view.labelText}" esperado="${item.app.get_name()}"`);
        item.hover = false;
        await wait(600);
        console.log(`PROBE etiqueta[fuera] "${view.labelText}"`);

        item.popupMenu();
        await wait(600);
        console.log(`PROBE menu[abrir] abierto=${item.menuOpen}`);
        await this._screenshot('menu');
        item._menu.close();
        await wait(600);
        console.log(`PROBE menu[cerrar] abierto=${item.menuOpen}`);
    }

    /**
     * Arrastra la primera favorita detrás de la tercera usando los
     * métodos de destino de DockView, y la devuelve a su sitio.
     */
    async _checkReorder() {
        const view = this._dockView();
        const favorites = AppFavorites.getAppFavorites();
        const items = this._dockItems()
            .filter(i => i.get_parent().name === 'bahiaDockFavorites');
        if (!view || items.length < 3) {
            console.log('PROBE reordenar sin favoritas suficientes');
            return;
        }

        const source = items[0];
        const id = source.app.get_id();
        const motion = view.handleDragOver(source, null, 0, this._favoriteY(items[2], 1));
        const accepted = view.acceptDrop(source);
        await wait(800);
        const pos = favorites.getFavorites().findIndex(app => app.get_id() === id);
        console.log(`PROBE reordenar ${id} motion=${motion} aceptado=${accepted} pos=${pos} esperado=2`);

        favorites.moveFavoriteToPos(id, 0);
        await wait(500);
    }

    /** Iconos del dock (DockItem), en orden. */
    _dockItems() {
        const area = Main.layoutManager.uiGroup.get_children()
            .find(a => a.name === 'bahiaDockArea');
        const items = [];
        const collect = actor => {
            for (const child of actor.get_children()) {
                if (child.app)
                    items.push(child);
                else
                    collect(child);
            }
        };
        if (area)
            collect(area);
        return items;
    }

    /**
     * Registra el estado del icono de una app:
     * sección, puntos y foco, o "ausente" si no está en el dock.
     */
    _reportItem(label, id) {
        const item = this._dockItems().find(i => i.app.get_id() === id);
        if (!item) {
            console.log(`PROBE item[${label}] ${id} ausente`);
            return;
        }
        console.log(`PROBE item[${label}] ${id} section=${item.get_parent().name} ` +
            `dots=${item.dotCount} focused=${item.focused}`);
    }

    /** Espera hasta que cond() sea cierta, como mucho timeoutMs. */
    async _waitFor(cond, timeoutMs = 10000) {
        for (let t = 0; t < timeoutMs && !cond(); t += 250)
            await wait(250);
    }

    /**
     * Simula un clic en el primer icono cuya app no esté abierta y
     * recorre los estados de la Fase 2.
     */
    async _clickFirstStoppedApp() {
        const item = this._dockItems().find(i => i.app.state === Shell.AppState.STOPPED &&
            i.app.get_id() !== 'org.mozilla.firefox.desktop');
        if (!item) {
            console.log('PROBE click sin apps cerradas para probar');
            return;
        }

        const app = item.app;
        const id = app.get_id();
        item.emit('clicked', 1);
        await this._waitFor(() => app.get_n_windows() > 0);
        // Margen para que llegue el foco.
        await this._waitFor(() => Shell.WindowTracker.get_default().focus_app === app, 3000);
        console.log(`PROBE click ${id} state=${app.state} windows=${app.get_n_windows()}`);
        this._reportItem('abierta', id);
        await this._screenshot('abierta');

        // Clic con el foco: minimiza. Otro clic: restaura y enfoca.
        const minimized = () => app.get_windows().filter(w => w.minimized).length;
        item.emit('clicked', 1);
        await this._waitFor(() => minimized() === app.get_n_windows(), 3000);
        console.log(`PROBE minimizar ${id} minimizadas=${minimized()}/${app.get_n_windows()}`);
        item.emit('clicked', 1);
        await this._waitFor(() => minimized() === 0 &&
            Shell.WindowTracker.get_default().focus_app === app, 3000);
        console.log(`PROBE restaurar ${id} minimizadas=${minimized()} ` +
            `foco=${Shell.WindowTracker.get_default().focus_app === app}`);

        // Fuera de favoritas debe pasar a la sección de abiertas.
        const favorites = AppFavorites.getAppFavorites();
        favorites.removeFavorite(id);
        await wait(500);
        this._reportItem('no-favorita', id);
        await this._screenshot('no-favorita');

        // Arrastrarla al principio de las favoritas la vuelve a fijar.
        const view = this._dockView();
        const first = this._dockItems()
            .find(i => i.get_parent().name === 'bahiaDockFavorites');
        const running = this._dockItems().find(i => i.app === app);
        if (view && first && running) {
            const motion = view.handleDragOver(running, null, 0, this._favoriteY(first, -first.height / 4));
            const accepted = view.acceptDrop(running);
            await wait(800);
            const pos = favorites.getFavorites().indexOf(app);
            console.log(`PROBE fijar ${id} motion=${motion} aceptado=${accepted} pos=${pos} esperado=0`);
            this._reportItem('fijada', id);
            favorites.removeFavorite(id);
            await wait(500);
        }

        // Al cerrarla debe desaparecer del dock.
        for (const win of app.get_windows())
            win.delete(global.get_current_time());
        await this._waitFor(() => app.state === Shell.AppState.STOPPED);
        await wait(500);
        this._reportItem('cerrada', id);

        favorites.addFavorite(id);
    }

    _report(label) {
        const monitor = Main.layoutManager.primaryMonitor;
        const workArea = Main.layoutManager.getWorkAreaForMonitor(monitor.index);
        console.log(`PROBE [${label}] monitor ${rect(monitor)}`);
        console.log(`PROBE [${label}] workarea ${rect(workArea)}`);

        const area = Main.layoutManager.uiGroup.get_children()
            .find(a => a.name === 'bahiaDockArea');
        if (area) {
            const [ax, ay] = area.get_transformed_position();
            console.log(`PROBE [${label}] dock-area x=${ax} y=${ay} w=${area.width} h=${area.height} visible=${area.visible}`);
            const view = area.get_first_child();
            const [vx, vy] = view.get_transformed_position();
            console.log(`PROBE [${label}] dock-view x=${vx} y=${vy} w=${view.width} h=${view.height} items=${view.itemCount} icon=${view.iconSize}`);
        } else {
            console.log(`PROBE [${label}] dock-area NO ENCONTRADA`);
        }

        const dash = Main.overview.dash;
        console.log(`PROBE [${label}] dash-nativo visible=${dash?.visible} height=${dash?.height}`);
    }

    async _screenshot(name) {
        if (this._cancelled)
            return;
        const path = GLib.build_filenamev([GLib.get_user_runtime_dir(), `probe-${name}.png`]);
        const file = Gio.File.new_for_path(path);
        const stream = file.replace(null, false, Gio.FileCreateFlags.NONE, null);
        const shooter = new Shell.Screenshot();
        await shooter.screenshot(false, stream);
        stream.close(null);
        console.log(`PROBE captura ${path}`);
    }
}
