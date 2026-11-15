/* core/logger.js
 *
 * Envoltorio del registro de la extensión. Usa el logger de GNOME Shell,
 * que ya antepone "[Bahía Dock]" a cada mensaje, y añade el nombre del
 * módulo. Los mensajes de depuración solo se emiten si la clave
 * "debug-logging" está activada.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

export class Logger {
    /**
     * @param {Console} shellLogger - resultado de Extension.getLogger()
     * @param {Gio.Settings} settings - ajustes de la extensión
     * @param {string} [scope] - nombre del módulo que registra
     */
    constructor(shellLogger, settings, scope = null) {
        this._shellLogger = shellLogger;
        this._settings = settings;
        this._scope = scope;
    }

    /**
     * Crea un logger hijo con el nombre de un módulo.
     *
     * @param {string} scope - nombre del módulo
     * @returns {Logger}
     */
    child(scope) {
        return new Logger(this._shellLogger, this._settings, scope);
    }

    _format(message) {
        return this._scope ? `(${this._scope}) ${message}` : message;
    }

    debug(message, ...args) {
        if (this._settings?.get_boolean('debug-logging'))
            this._shellLogger.log(this._format(message), ...args);
    }

    info(message, ...args) {
        this._shellLogger.log(this._format(message), ...args);
    }

    warn(message, ...args) {
        this._shellLogger.warn(this._format(message), ...args);
    }

    error(message, ...args) {
        this._shellLogger.error(this._format(message), ...args);
    }

    destroy() {
        this._shellLogger = null;
        this._settings = null;
    }
}
