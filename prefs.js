/* prefs.js
 *
 * Ventana de preferencias de Bahía Dock. Se ejecuta en un proceso
 * aparte (la app Extensiones), no dentro de GNOME Shell, así que no
 * puede importar módulos de resource:///org/gnome/shell/ui/.
 *
 * En la Fase 0 solo ofrece los interruptores básicos. Las páginas por
 * módulo llegarán en la Fase 5 dentro de prefs/.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

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

        const development = new Adw.PreferencesGroup({title: 'Desarrollo'});
        page.add(development);
        development.add(this._switchRow(settings, 'debug-logging',
            'Registro de depuración', 'Escribe mensajes de depuración en journalctl'));
    }

    _switchRow(settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({title, subtitle});
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
        return row;
    }
}
