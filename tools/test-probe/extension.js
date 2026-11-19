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
 *   6. Comprueba el modo claro, la magnificación (sin cambiar el
 *      espacio reservado), los modos de visibilidad y el menú de
 *      configuración (Fase 4).
 *   7. Comprueba que la franja del dock muestra el fondo de pantalla al
 *      abrir la vista general, y los ajustes de la Fase 5: tamaño de
 *      iconos, opacidad, margen, apps abiertas, botón de aplicaciones,
 *      espera de ocultado y monitor.
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
Gio._promisify(Shell.Screenshot.prototype, 'pick_color');

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
        await this._checkOverviewBackdrop();

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
        await this._checkTheme();
        await this._checkMagnification();
        await this._checkVisibility();
        await this._checkSettingsMenu();
        await this._checkPreferences();
        console.log('PROBE fin');
    }

    /** Color de un píxel del escenario como "r,g,b". */
    async _pick(x, y) {
        const [color] = await new Shell.Screenshot().pick_color(x, y);
        return `${color.red},${color.green},${color.blue}`;
    }

    /**
     * Franja del dock por encima de la píldora mientras se abre la vista
     * general: debe verse el fondo de pantalla, no un corte.
     */
    async _checkOverviewBackdrop() {
        const view = this._dockView();
        if (!view) {
            console.log('PROBE fondo sin dock');
            return;
        }
        const [, viewY] = view.get_transformed_position();
        const panel = Main.panel.height;
        const x = 30;
        const y = Math.round(panel + (viewY - panel) / 2);

        const desk = await this._pick(x, y);
        const samples = [];
        Main.overview.show();
        const start = GLib.get_monotonic_time();
        for (const ms of [40, 100, 200]) {
            const elapsed = (GLib.get_monotonic_time() - start) / 1000;
            if (ms > elapsed)
                await wait(ms - elapsed);
            samples.push(`${ms}ms=${await this._pick(x, y)}`);
        }
        await wait(1500);
        const overview = await this._pick(x, y);
        Main.overview.hide();
        await wait(1500);

        // Captura a mitad de animación para verlo.
        Main.overview.show();
        await wait(60);
        await this._screenshot('entrando-overview');
        await wait(1500);
        Main.overview.hide();
        await wait(1500);

        console.log(`PROBE fondo x=${x} y=${y} escritorio=${desk} ${samples.join(' ')} overview=${overview}`);
    }

    /** Ajustes de la Fase 5: cada cambio debe verse al momento. */
    async _checkPreferences() {
        const feature = this._dockFeature();
        const view = this._dockView();
        if (!feature || !view) {
            console.log('PROBE ajustes sin dock');
            return;
        }
        const settings = feature.settings;
        const area = view.get_parent();

        // Tamaño de iconos
        const widthBefore = area.width;
        settings.set_int('dock-icon-size', 32);
        await wait(500);
        console.log(`PROBE ajustes[icono] tamano=${view.iconSize} area=${widthBefore}->${area.width}`);
        settings.reset('dock-icon-size');
        await wait(300);

        // Opacidad y margen
        settings.set_double('dock-background-opacity', 0.3);
        settings.set_int('dock-edge-margin', 12);
        await wait(500);
        console.log(`PROBE ajustes[pildora] estilo="${view.get_style()}" margen=${view.x}`);
        await this._screenshot('ajustes-pildora');
        settings.reset('dock-background-opacity');
        settings.reset('dock-edge-margin');
        await wait(300);
        console.log(`PROBE ajustes[pildora-reset] margen=${view.x}`);

        // Apps abiertas: el Editor de texto abierto pasa a no favorito
        // (solo en el entorno aislado) para verlo en la sección de abiertas.
        const favorites = AppFavorites.getAppFavorites();
        const editorId = 'org.gnome.TextEditor.desktop';
        const wasFavorite = favorites.isFavorite(editorId);
        if (wasFavorite)
            favorites.removeFavorite(editorId);
        await wait(500);
        const shown = () => this._dockItems().some(i => i.app.get_id() === editorId);
        const before = shown();
        settings.set_boolean('dock-show-running', false);
        await wait(500);
        const hidden = !shown();
        settings.reset('dock-show-running');
        await wait(500);
        console.log(`PROBE ajustes[abiertas] visible=${before} oculta=${hidden} vuelve=${shown()}`);
        if (wasFavorite)
            favorites.addFavoriteAtPos(editorId, 4);

        // Botón de aplicaciones
        const countBefore = view.itemCount;
        settings.set_boolean('dock-show-apps-button', false);
        await wait(500);
        view.openSettingsMenu();
        await wait(500);
        console.log(`PROBE ajustes[cuadricula] visible=${view.showAppsButtonVisible} ` +
            `items=${countBefore}->${view.itemCount} menu=${view.settingsMenu.isOpen}`);
        view.settingsMenu.close();
        settings.reset('dock-show-apps-button');
        await wait(500);

        // Espera de ocultado
        settings.set_int('dock-hide-delay', 100);
        settings.set_string('dock-visibility', 'autohide');
        await wait(450);
        console.log(`PROBE ajustes[espera] mostrado=${feature._visibility.shown}`);
        settings.reset('dock-visibility');
        settings.reset('dock-hide-delay');
        await wait(1000);

        // Monitor
        const monitors = Main.layoutManager.monitors;
        const manager = global.backend.get_monitor_manager();
        const connectors = manager.get_monitors().map(m => m.get_connector());
        settings.set_string('dock-monitor', 'NO-EXISTE-1');
        await wait(500);
        const [fallbackX] = area.get_transformed_position();
        console.log(`PROBE ajustes[monitor-inexistente] x=${fallbackX} principal=${Main.layoutManager.primaryMonitor.x}`);
        const other = monitors.find(m => m.index !== Main.layoutManager.primaryIndex);
        if (other) {
            const connector = connectors.find(c => manager.get_monitor_for_connector(c) === other.index);
            settings.set_string('dock-monitor', connector);
            await wait(800);
            const [x, y] = area.get_transformed_position();
            console.log(`PROBE ajustes[monitor] conector=${connector} x=${x} y=${y} ` +
                `esperado=${other.x},${other.y} alto=${area.height}/${other.height}`);
            await this._screenshot('otro-monitor');
        } else {
            console.log(`PROBE ajustes[monitor] un solo monitor (${connectors.join(',')})`);
        }
        settings.reset('dock-monitor');
        await wait(800);
    }

    /** El módulo del dock dentro de la extensión (solo para la prueba). */
    _dockFeature() {
        const ext = Main.extensionManager.lookup('bahia-dock@bahia-dock.github.io');
        return ext?.stateObj?._featureManager?._features?.get('dock') ?? null;
    }

    _workAreaX() {
        const monitor = Main.layoutManager.primaryMonitor;
        return Main.layoutManager.getWorkAreaForMonitor(monitor.index).x;
    }

    /** Esquema claro y vuelta al oscuro (en el entorno aislado). */
    async _checkTheme() {
        const view = this._dockView();
        const iface = new Gio.Settings({schema_id: 'org.gnome.desktop.interface'});
        iface.set_string('color-scheme', 'prefer-light');
        await wait(800);
        console.log(`PROBE tema[claro] clase=${view.has_style_class_name('bahia-dock-light')}`);
        await this._screenshot('claro');
        iface.set_string('color-scheme', 'default');
        await wait(800);
        console.log(`PROBE tema[oscuro] clase=${view.has_style_class_name('bahia-dock-light')}`);
    }

    /** Magnifica sobre el tercer icono y comprueba que no cambia el área. */
    async _checkMagnification() {
        const feature = this._dockFeature();
        const items = this._dockItems();
        if (!feature?._magnifier || items.length < 4) {
            console.log('PROBE magnificar sin iconos suficientes');
            return;
        }

        const area = this._dockView().get_parent();
        const widthBefore = area.width;
        const workBefore = this._workAreaX();
        const [, y] = items[2].get_transformed_position();
        feature._magnifier.magnifyAt(y + items[2].height / 2);
        await wait(500);
        const scales = items.slice(0, 5).map(i => i.magnification.toFixed(2)).join(',');
        // El icono magnificado no debe salirse de la píldora por la derecha.
        const view = this._dockView();
        const [viewX] = view.get_transformed_position();
        const inside = items[2].iconRightEdge <= viewX + view.width + 0.5;
        console.log(`PROBE magnificar dentro=${inside} escalas=${scales} ` +
            `area=${widthBefore}->${area.width} workarea=${workBefore}->${this._workAreaX()}`);
        await this._screenshot('magnificado');

        feature._magnifier.release();
        await wait(600);
        const max = Math.max(...this._dockItems().map(i => i.magnification));
        console.log(`PROBE magnificar[fin] max=${max}`);
    }

    /** Ocultado automático e intellihide con la ventana maximizada. */
    async _checkVisibility() {
        const feature = this._dockFeature();
        const visibility = feature?._visibility;
        if (!visibility) {
            console.log('PROBE visibilidad sin módulo');
            return;
        }
        const settings = feature.settings;

        settings.set_string('dock-visibility', 'autohide');
        await wait(1500);
        console.log(`PROBE visibilidad[autohide] mostrado=${visibility.shown} ` +
            `workarea=${this._workAreaX()} borde=${visibility.edge !== null}`);
        await this._screenshot('autohide');

        visibility.edge.hover = true;
        await wait(500);
        console.log(`PROBE visibilidad[borde] mostrado=${visibility.shown}`);
        visibility.edge.hover = false;
        await wait(1500);
        console.log(`PROBE visibilidad[salir] mostrado=${visibility.shown}`);

        // La ventana del Editor de texto sigue maximizada y, sin espacio
        // reservado, ocupa el sitio del dock.
        settings.set_string('dock-visibility', 'intellihide');
        await wait(1500);
        console.log(`PROBE visibilidad[intellihide] tapado=${visibility.overlap} mostrado=${visibility.shown}`);

        const wins = global.display.list_all_windows()
            .filter(w => w.get_window_type() === Meta.WindowType.NORMAL);
        wins.forEach(w => w.minimize());
        await wait(1500);
        console.log(`PROBE visibilidad[minimizada] tapado=${visibility.overlap} mostrado=${visibility.shown}`);
        wins.forEach(w => w.unminimize());

        settings.set_string('dock-visibility', 'always');
        await wait(1500);
        console.log(`PROBE visibilidad[always] mostrado=${visibility.shown} ` +
            `workarea=${this._workAreaX()} borde=${visibility.edge !== null}`);
    }

    /** Menú de configuración: abre, elige un modo y sigue a GSettings. */
    async _checkSettingsMenu() {
        const view = this._dockView();
        const feature = this._dockFeature();
        const menu = view?.settingsMenu;
        if (!menu || !feature) {
            console.log('PROBE configuracion sin menú');
            return;
        }
        const settings = feature.settings;

        view.openSettingsMenu();
        await wait(600);
        console.log(`PROBE configuracion[abrir] abierto=${menu.isOpen} modo=${menu.selectedMode}`);
        await this._screenshot('configuracion');

        menu.activateMode('autohide');
        await wait(800);
        console.log(`PROBE configuracion[elegir] clave=${settings.get_string('dock-visibility')} ` +
            `abierto=${menu.isOpen} modo=${menu.selectedMode}`);

        settings.set_string('dock-visibility', 'intellihide');
        await wait(300);
        console.log(`PROBE configuracion[sincronizar] modo=${menu.selectedMode}`);

        settings.set_string('dock-visibility', 'always');
        await wait(1000);
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
