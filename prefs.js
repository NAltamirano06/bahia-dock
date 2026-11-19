/* prefs.js
 *
 * Ventana de preferencias de Bahía Dock. Se ejecuta en un proceso
 * aparte (la app Extensiones), no dentro de GNOME Shell, así que no
 * puede importar módulos de resource:///org/gnome/shell/ui/.
 *
 * Ofrece los interruptores básicos y los ajustes del dock. Las páginas
 * por módulo llegarán en la Fase 5 dentro de prefs/.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

// Mismo orden que las opciones de la clave dock-visibility.
const VISIBILITY = [
    ['always', 'Siempre visible'],
    ['autohide', 'Ocultar automáticamente'],
    ['intellihide', 'Ocultar si una ventana lo tapa'],
];

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class BahiaDockPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window) {
        const settings = this.getSettings();
        window._settings = settings;

        const page = new Adw.PreferencesPage({
            title: 'General',
            icon_name: 'preferences-system-symbolic',
        });
        window.add(page);

        const modules = new Adw.PreferencesGroup({title: 'Módulos'});
        page.add(modules);
        modules.add(this._switchRow(settings, 'dock-enabled',
            'Dock', 'Muestra el dock vertical en el borde izquierdo'));

        const dock = new Adw.PreferencesGroup({title: 'Dock'});
        page.add(dock);
        dock.add(this._visibilityRow(settings));
        dock.add(this._switchRow(settings, 'dock-minimize-on-click',
            'Minimizar al hacer clic',
            'Un clic en la app que tiene el foco minimiza sus ventanas'));
        dock.add(this._switchRow(settings, 'dock-magnification',
            'Magnificación', 'Agranda los iconos al pasar el puntero'));

        const scale = new Adw.SpinRow({
            title: 'Tamaño con magnificación',
            subtitle: 'Escala del icono bajo el puntero',
            digits: 1,
            adjustment: new Gtk.Adjustment({lower: 1.1, upper: 2.0, step_increment: 0.1}),
        });
        settings.bind('dock-magnification-scale', scale, 'value', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('dock-magnification', scale, 'sensitive', Gio.SettingsBindFlags.GET);
        dock.add(scale);

        const development = new Adw.PreferencesGroup({title: 'Desarrollo'});
        page.add(development);
        development.add(this._switchRow(settings, 'debug-logging',
            'Registro de depuración', 'Escribe mensajes de depuración en journalctl'));
    }

    _visibilityRow(settings) {
        const row = new Adw.ComboRow({
            title: 'Visibilidad',
            model: Gtk.StringList.new(VISIBILITY.map(([, label]) => label)),
        });
        const sync = () => {
            const index = VISIBILITY.findIndex(([id]) => id === settings.get_string('dock-visibility'));
            row.selected = Math.max(0, index);
        };
        sync();
        const id = settings.connect('changed::dock-visibility', sync);
        row.connect('notify::selected', () => {
            const [value] = VISIBILITY[row.selected] ?? VISIBILITY[0];
            if (settings.get_string('dock-visibility') !== value)
                settings.set_string('dock-visibility', value);
        });
        row.connect('destroy', () => settings.disconnect(id));
        return row;
    }

    _switchRow(settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }
}
