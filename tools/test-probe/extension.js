/* tools/test-probe/extension.js
 *
 * Extensión auxiliar SOLO para tools/headless-test.sh. No forma parte
 * de Bahía Dock ni se empaqueta. Al activarse:
 *
 *   1. Registra la geometría del dock, el área de trabajo y el dash.
 *   2. Maximiza las ventanas abiertas y registra su posición.
 *   3. Guarda capturas del escritorio y de la vista general en
 *      $XDG_RUNTIME_DIR/probe-*.png.
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

        await this._clickFirstStoppedApp();
        console.log('PROBE fin');
    }

    /** Simula un clic en el primer icono cuya app no esté abierta. */
    async _clickFirstStoppedApp() {
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

        const item = items.find(i => i.app.state === Shell.AppState.STOPPED &&
            i.app.get_id() !== 'org.mozilla.firefox.desktop');
        if (!item) {
            console.log('PROBE click sin apps cerradas para probar');
            return;
        }

        const id = item.app.get_id();
        item.emit('clicked', 1);
        for (let i = 0; i < 20 && item.app.get_n_windows() === 0; i++)
            await wait(500);
        console.log(`PROBE click ${id} state=${item.app.state} windows=${item.app.get_n_windows()}`);
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
