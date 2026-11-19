/* prefs.js
 *
 * Ventana de preferencias de Bahía Dock. Se ejecuta en un proceso
 * aparte (la app Extensiones), no dentro de GNOME Shell, así que no
 * puede importar módulos de resource:///org/gnome/shell/ui/.
 *
 * Las páginas están en prefs/ (Fase 5):
 *
 *   Apariencia      iconos, magnificación, fondo, margen y contenido
 *   Comportamiento  visibilidad, ocultado, clics, módulos y desarrollo
 *   Monitores       en qué pantalla va el dock
 *
 * Todo se guarda en GSettings y el dock lo aplica al momento.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import {appearancePage} from './prefs/appearancePage.js';
import {behaviorPage} from './prefs/behaviorPage.js';
import {monitorsPage} from './prefs/monitorsPage.js';

export default class BahiaDockPreferences extends ExtensionPreferences {
    async fillPreferencesWindow(window) {
        const settings = this.getSettings();
        // Mantiene vivos los ajustes mientras la ventana esté abierta.
        window._settings = settings;

        window.add(appearancePage(settings));
        window.add(behaviorPage(settings));
        window.add(monitorsPage(settings));
    }
}
