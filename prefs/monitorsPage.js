/* prefs/monitorsPage.js
 *
 * Página "Monitores": en qué pantalla va el dock. Lista los monitores
 * conectados (GDK) por su conector, que es lo que guarda dock-monitor.
 * Si el monitor guardado no está conectado, aparece como "desconectado"
 * y el dock usa el principal hasta que vuelva.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';

const PRIMARY = 'Monitor principal';

/**
 * @param {Gdk.Monitor} monitor - monitor de GDK
 * @returns {string} texto para la lista
 */
function describe(monitor) {
    const name = [monitor.get_manufacturer(), monitor.get_model()]
        .filter(Boolean).join(' ');
    const {width, height} = monitor.get_geometry();
    const parts = [monitor.get_connector(), name, `${width}×${height}`].filter(Boolean);
    return parts.join(' — ');
}

/**
 * @param {Gio.Settings} settings - ajustes de la extensión
 * @returns {Adw.PreferencesPage}
 */
export function monitorsPage(settings) {
    const page = new Adw.PreferencesPage({
        title: 'Monitores',
        icon_name: 'video-display-symbolic',
    });

    const group = new Adw.PreferencesGroup({
        title: 'Pantalla',
        description: 'Con varios monitores, elige en cuál va el dock.',
    });
    page.add(group);

    const row = new Adw.ComboRow({title: 'Monitor del dock'});
    group.add(row);

    const monitors = Gdk.Display.get_default()?.get_monitors() ?? null;
    let connectors = [];
    let updating = false;

    // Reconstruye la lista: principal, monitores conectados y, si hace
    // falta, el guardado que no está conectado.
    const rebuild = () => {
        updating = true;
        const saved = settings.get_string('dock-monitor');
        const labels = [PRIMARY];
        connectors = [''];
        for (let i = 0; i < (monitors?.get_n_items() ?? 0); i++) {
            const monitor = monitors.get_item(i);
            const connector = monitor.get_connector();
            if (!connector)
                continue;
            connectors.push(connector);
            labels.push(describe(monitor));
        }
        if (saved && !connectors.includes(saved)) {
            connectors.push(saved);
            labels.push(`${saved} — desconectado`);
        }
        row.model = Gtk.StringList.new(labels);
        row.selected = Math.max(0, connectors.indexOf(saved));
        updating = false;
    };
    rebuild();

    row.connect('notify::selected', () => {
        if (updating)
            return;
        const value = connectors[row.selected] ?? '';
        if (settings.get_string('dock-monitor') !== value)
            settings.set_string('dock-monitor', value);
    });

    const settingsId = settings.connect('changed::dock-monitor', rebuild);
    const monitorsId = monitors?.connect('items-changed', rebuild) ?? 0;
    row.connect('destroy', () => {
        settings.disconnect(settingsId);
        if (monitorsId)
            monitors.disconnect(monitorsId);
    });

    return page;
}
