/* features/dock/nativeDash.js
 *
 * Oculta el dash nativo de la vista general mientras el dock está
 * activo y lo restaura al desactivarlo. No lo destruye: solo cambia su
 * visibilidad y altura, que es lo que la vista general usa para
 * reservarle espacio.
 *
 * La primera vez que se oculta, avisa con una notificación. La clave
 * "native-dash-notice-shown" evita repetir el aviso en cada inicio de
 * sesión o desbloqueo de pantalla.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export class NativeDash {
    /**
     * @param {Gio.Settings} settings - ajustes de la extensión
     * @param {Logger} logger - logger del módulo
     */
    constructor(settings, logger) {
        this._settings = settings;
        this._logger = logger;
        this._dash = null;
    }

    hide() {
        if (Main.overview.isDummy || !Main.overview.dash) {
            this._logger.debug('No hay vista general; no se oculta el dash');
            return;
        }

        this._dash = Main.overview.dash;
        this._dash.hide();
        // Altura 0: la vista general deja de reservarle espacio abajo.
        this._dash.set_height(0);
        this._logger.debug('Dash nativo oculto');

        this._notifyOnce();
    }

    restore() {
        if (!this._dash)
            return;

        // -1 devuelve la altura al cálculo automático.
        this._dash.set_height(-1);
        this._dash.show();
        this._dash = null;
        this._logger.debug('Dash nativo restaurado');
    }

    _notifyOnce() {
        if (this._settings.get_boolean('native-dash-notice-shown'))
            return;

        Main.notify('Bahía Dock está activo',
            'El dash de la vista general se ha ocultado porque Bahía Dock lo sustituye. ' +
            'Volverá a aparecer si desactivas la extensión.');
        this._settings.set_boolean('native-dash-notice-shown', true);
    }
}
