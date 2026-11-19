/* tools/prefs-check.js
 *
 * Comprobación de las páginas de preferencias SOLO para
 * tools/headless-test.sh. Construye las páginas de prefs/ en una
 * ventana de libadwaita, cambia algunos controles y comprueba que las
 * claves de GSettings cambian (y al revés). No forma parte de la
 * extensión ni se empaqueta.
 *
 * Uso: GSETTINGS_SCHEMA_DIR=schemas gjs -m tools/prefs-check.js
 * Escribe líneas "PREFS ..." y termina con "PREFS fin" o "PREFS ERROR".
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import {appearancePage} from '../prefs/appearancePage.js';
import {behaviorPage} from '../prefs/behaviorPage.js';
import {monitorsPage} from '../prefs/monitorsPage.js';

/** Recorre los hijos de un widget buscando filas por título. */
function findRow(widget, title) {
    if (widget.title === title && widget instanceof Adw.PreferencesRow)
        return widget;
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling()) {
        const found = findRow(child, title);
        if (found)
            return found;
    }
    return null;
}

const app = new Adw.Application({application_id: 'io.github.bahiadock.PrefsCheck'});
app.connect('activate', () => {
    try {
        const settings = new Gio.Settings({schema_id: 'org.gnome.shell.extensions.bahia-dock'});
        const window = new Adw.PreferencesWindow({application: app});
        const pages = [appearancePage(settings), behaviorPage(settings), monitorsPage(settings)];
        pages.forEach(page => window.add(page));
        window.present();
        print(`PREFS paginas=${pages.map(p => p.title).join(',')}`);

        // Control → clave
        findRow(pages[0], 'Tamaño de los iconos').value = 40;
        findRow(pages[1], 'Visibilidad').selected = 2;
        findRow(pages[0], 'Mostrar las apps abiertas').active = false;
        print(`PREFS control->clave icono=${settings.get_int('dock-icon-size')} ` +
            `visibilidad=${settings.get_string('dock-visibility')} ` +
            `abiertas=${settings.get_boolean('dock-show-running')}`);

        // Clave → control (como si cambiara desde el menú del dock)
        settings.set_string('dock-visibility', 'autohide');
        const monitorRow = findRow(pages[2], 'Monitor del dock');
        settings.set_string('dock-monitor', 'NO-EXISTE-1');
        print(`PREFS clave->control visibilidad=${findRow(pages[1], 'Visibilidad').selected} ` +
            `monitor="${monitorRow.model.get_string(monitorRow.selected)}" ` +
            `opciones=${monitorRow.model.get_n_items()}`);

        for (const key of ['dock-icon-size', 'dock-visibility', 'dock-show-running', 'dock-monitor'])
            settings.reset(key);
        Gio.Settings.sync();

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 300, () => {
            print('PREFS fin');
            app.quit();
            return GLib.SOURCE_REMOVE;
        });
    } catch (e) {
        print(`PREFS ERROR ${e}\n${e.stack}`);
        app.quit();
    }
});
app.run([]);
