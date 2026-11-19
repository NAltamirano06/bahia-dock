/* prefs/behaviorPage.js
 *
 * Página "Comportamiento": visibilidad y ocultado, clics, módulos y
 * opciones de desarrollo.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Adw from 'gi://Adw';

import {choiceRow, spinRow, switchRow} from './rows.js';

// Mismo orden y textos que el menú de configuración del dock
// (features/dock/dockSettingsMenu.js).
const VISIBILITY = [
    ['always', 'Siempre visible'],
    ['autohide', 'Ocultar automáticamente'],
    ['intellihide', 'Ocultar si una ventana lo tapa'],
];

/**
 * @param {Gio.Settings} settings - ajustes de la extensión
 * @returns {Adw.PreferencesPage}
 */
export function behaviorPage(settings) {
    const page = new Adw.PreferencesPage({
        title: 'Comportamiento',
        icon_name: 'preferences-system-symbolic',
    });

    const visibility = new Adw.PreferencesGroup({title: 'Visibilidad'});
    page.add(visibility);
    visibility.add(choiceRow(settings, 'dock-visibility', 'Visibilidad',
        'Siempre visible reserva su espacio; los otros modos aparecen al llevar el puntero al borde',
        VISIBILITY));
    visibility.add(spinRow(settings, 'dock-hide-delay', {
        title: 'Espera antes de ocultar',
        subtitle: 'Milisegundos',
        lower: 0, upper: 2000, step: 100,
    }));
    visibility.add(spinRow(settings, 'dock-animation-time', {
        title: 'Duración de la animación',
        subtitle: 'Milisegundos al aparecer o esconderse',
        lower: 0, upper: 500, step: 50,
    }));

    const clicks = new Adw.PreferencesGroup({title: 'Clics'});
    page.add(clicks);
    clicks.add(switchRow(settings, 'dock-minimize-on-click',
        'Minimizar al hacer clic',
        'Un clic en la app que tiene el foco minimiza sus ventanas'));

    const modules = new Adw.PreferencesGroup({title: 'Módulos'});
    page.add(modules);
    modules.add(switchRow(settings, 'dock-enabled',
        'Dock', 'Muestra el dock vertical en el borde izquierdo'));

    const development = new Adw.PreferencesGroup({title: 'Desarrollo'});
    page.add(development);
    development.add(switchRow(settings, 'debug-logging',
        'Registro de depuración', 'Escribe mensajes de depuración en journalctl'));

    return page;
}
