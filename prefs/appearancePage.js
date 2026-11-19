/* prefs/appearancePage.js
 *
 * Página "Apariencia": tamaño de los iconos, magnificación, fondo y
 * margen de la píldora, y qué secciones se muestran.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import Adw from 'gi://Adw';
import Gio from 'gi://Gio';

import {spinRow, switchRow} from './rows.js';

/**
 * @param {Gio.Settings} settings - ajustes de la extensión
 * @returns {Adw.PreferencesPage}
 */
export function appearancePage(settings) {
    const page = new Adw.PreferencesPage({
        title: 'Apariencia',
        icon_name: 'applications-graphics-symbolic',
    });

    const icons = new Adw.PreferencesGroup({title: 'Iconos'});
    page.add(icons);
    icons.add(spinRow(settings, 'dock-icon-size', {
        title: 'Tamaño de los iconos',
        subtitle: 'En píxeles; se reducen solos si no caben en la pantalla',
        lower: 32, upper: 64, step: 4,
    }));
    icons.add(switchRow(settings, 'dock-magnification',
        'Magnificación', 'Agranda los iconos al pasar el puntero'));
    const scale = spinRow(settings, 'dock-magnification-scale', {
        title: 'Tamaño con magnificación',
        subtitle: 'Escala del icono bajo el puntero; el dock se ensancha para que quepa',
        lower: 1.1, upper: 2.0, step: 0.1, digits: 1,
    });
    settings.bind('dock-magnification', scale, 'sensitive', Gio.SettingsBindFlags.GET);
    icons.add(scale);

    const pill = new Adw.PreferencesGroup({title: 'Píldora'});
    page.add(pill);
    pill.add(spinRow(settings, 'dock-background-opacity', {
        title: 'Opacidad del fondo',
        subtitle: 'De 0 (transparente) a 1 (opaco)',
        lower: 0, upper: 1, step: 0.05, digits: 2,
    }));
    pill.add(spinRow(settings, 'dock-edge-margin', {
        title: 'Separación con el borde',
        subtitle: 'Píxeles entre el dock y el borde izquierdo de la pantalla',
        lower: 0, upper: 16, step: 1,
    }));

    const content = new Adw.PreferencesGroup({title: 'Contenido'});
    page.add(content);
    content.add(switchRow(settings, 'dock-show-running',
        'Mostrar las apps abiertas', 'Las aplicaciones abiertas que no son favoritas'));
    content.add(switchRow(settings, 'dock-show-apps-button',
        'Mostrar el botón de aplicaciones',
        'Sin él, el menú de configuración se abre con clic derecho en una zona vacía del dock'));

    return page;
}
